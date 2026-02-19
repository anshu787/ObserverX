import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { user_id, incident_id, anomaly, runbook_id } = await req.json();

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // If specific runbook_id, execute that one; otherwise find matching runbooks
    let runbooksToExecute: any[] = [];

    if (runbook_id) {
      const { data } = await adminClient.from("runbooks").select("*").eq("id", runbook_id).eq("enabled", true).single();
      if (data) runbooksToExecute = [data];
    } else if (anomaly && user_id) {
      // Find runbooks matching the anomaly
      const { data: runbooks } = await adminClient
        .from("runbooks")
        .select("*")
        .eq("user_id", user_id)
        .eq("enabled", true);

      for (const rb of runbooks || []) {
        const cond = rb.trigger_conditions || {};
        // Check cooldown
        if (rb.last_triggered_at) {
          const cooldownEnd = new Date(rb.last_triggered_at).getTime() + rb.cooldown_minutes * 60000;
          if (Date.now() < cooldownEnd) continue;
        }
        // Match conditions
        const metricMatch = !cond.metric || cond.metric === anomaly.metric || cond.metric === "any";
        const severityMatch = !cond.severity || cond.severity === anomaly.severity || cond.severity === "any";
        const serverMatch = !cond.server || cond.server === anomaly.server || cond.server === "any";
        if (metricMatch && severityMatch && serverMatch) {
          runbooksToExecute.push(rb);
        }
      }
    }

    const results: any[] = [];

    for (const runbook of runbooksToExecute) {
      const steps = runbook.steps || [];
      const stepsCompleted: any[] = [];
      let hasError = false;

      // Create execution record
      const { data: execution } = await adminClient.from("runbook_executions").insert({
        runbook_id: runbook.id,
        user_id: runbook.user_id,
        incident_id: incident_id || null,
        status: "running",
      }).select("id").single();

      const executionId = execution?.id;

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const stepResult: any = { index: i, action: step.action, status: "completed", timestamp: new Date().toISOString() };

        try {
          switch (step.action) {
            case "scale_up":
              // Simulate: update server metadata
              if (step.server_name) {
                const { data: srv } = await adminClient.from("servers").select("id, metadata").eq("user_id", runbook.user_id).eq("name", step.server_name).single();
                if (srv) {
                  const meta = (srv.metadata || {}) as Record<string, any>;
                  meta.instances = (meta.instances || 1) + (step.count || 2);
                  meta.last_scaled_at = new Date().toISOString();
                  meta.scaled_by = "runbook";
                  await adminClient.from("servers").update({ metadata: meta }).eq("id", srv.id);
                  stepResult.detail = `Scaled ${step.server_name} to ${meta.instances} instances`;
                }
              }
              break;

            case "restart_service":
              // Simulate: mark service as restarting, then healthy
              if (step.service_name) {
                const { data: svc } = await adminClient.from("services").select("id").eq("user_id", runbook.user_id).eq("name", step.service_name).single();
                if (svc) {
                  await adminClient.from("services").update({ status: "healthy", health_score: 95 }).eq("id", svc.id);
                  stepResult.detail = `Restarted ${step.service_name}`;
                }
              }
              break;

            case "notify_team":
              // Send webhook notification about runbook execution
              try {
                await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-webhook`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}` },
                  body: JSON.stringify({
                    event_type: "incident",
                    title: `[Runbook] ${runbook.name} executed`,
                    message: step.message || `Runbook "${runbook.name}" auto-executed for incident.`,
                    severity: "info",
                    user_id: runbook.user_id,
                    metadata: { runbook_id: runbook.id, runbook_name: runbook.name },
                  }),
                });
                stepResult.detail = "Webhook notification sent";
              } catch {
                stepResult.detail = "Webhook delivery attempted";
              }
              break;

            case "update_incident":
              if (incident_id) {
                await adminClient.from("incidents").update({
                  status: step.new_status || "investigating",
                  ai_analysis: {
                    runbook_executed: runbook.name,
                    auto_remediation: true,
                    executed_at: new Date().toISOString(),
                  },
                }).eq("id", incident_id);
                stepResult.detail = `Incident status updated to ${step.new_status || "investigating"}`;
              }
              break;

            case "create_log":
              const { data: firstServer } = await adminClient.from("servers").select("id").eq("user_id", runbook.user_id).limit(1).single();
              if (firstServer) {
                await adminClient.from("logs").insert({
                  server_id: firstServer.id,
                  severity: "info",
                  message: step.message || `[Runbook] ${runbook.name} auto-executed`,
                  source: "runbook-engine",
                });
                stepResult.detail = "Log entry created";
              }
              break;

            case "wait":
              const waitMs = (step.seconds || 5) * 1000;
              await new Promise((r) => setTimeout(r, Math.min(waitMs, 30000)));
              stepResult.detail = `Waited ${step.seconds || 5}s`;
              break;

            default:
              stepResult.status = "skipped";
              stepResult.detail = `Unknown action: ${step.action}`;
          }
        } catch (err: any) {
          stepResult.status = "failed";
          stepResult.detail = err.message;
          hasError = true;
        }

        stepsCompleted.push(stepResult);

        // Update execution progress
        if (executionId) {
          await adminClient.from("runbook_executions").update({
            steps_completed: stepsCompleted,
          }).eq("id", executionId);
        }
      }

      // Mark execution complete
      if (executionId) {
        await adminClient.from("runbook_executions").update({
          status: hasError ? "failed" : "completed",
          steps_completed: stepsCompleted,
          completed_at: new Date().toISOString(),
          error_message: hasError ? "One or more steps failed" : null,
        }).eq("id", executionId);
      }

      // Update last triggered
      await adminClient.from("runbooks").update({ last_triggered_at: new Date().toISOString() }).eq("id", runbook.id);

      results.push({ runbook_id: runbook.id, runbook_name: runbook.name, status: hasError ? "failed" : "completed", stepsCompleted });
    }

    return new Response(JSON.stringify({ executed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("execute-runbook error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
