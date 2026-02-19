import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { incident_id, incident_title, severity, user_id, policy_id } = await req.json();

    if (!user_id || !policy_id || !incident_title) {
      throw new Error("Missing required fields: user_id, policy_id, incident_title");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Fetch escalation policy and its levels
    const { data: policy } = await admin
      .from("escalation_policies")
      .select("*")
      .eq("id", policy_id)
      .maybeSingle();

    if (!policy) throw new Error("Policy not found");

    const { data: levels } = await admin
      .from("escalation_levels")
      .select("*")
      .eq("policy_id", policy_id)
      .order("level_order");

    if (!levels?.length) {
      return new Response(JSON.stringify({ notified: 0, message: "No escalation levels" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];

    // Process each escalation level
    for (const level of levels) {
      let targetName = level.contact_name || "Unknown";
      let targetEmail = level.contact_email;

      // If linked to a schedule, get current on-call member
      if (level.schedule_id) {
        const { data: schedule } = await admin
          .from("oncall_schedules")
          .select("*")
          .eq("id", level.schedule_id)
          .maybeSingle();

        if (schedule) {
          const { data: members } = await admin
            .from("oncall_members")
            .select("*")
            .eq("schedule_id", schedule.id)
            .order("position");

          if (members?.length) {
            const onCallMember = members[schedule.current_index % members.length];
            targetName = onCallMember.member_name;
            targetEmail = onCallMember.member_email;
          }
        }
      }

      // Deliver notification based on method
      if (level.notify_method === "in_app" || level.notify_method === "email") {
        // Always create in-app notification
        await admin.from("notifications").insert({
          user_id,
          title: `🚨 Escalation L${level.level_order + 1}: ${incident_title}`,
          message: `Notifying ${targetName} via ${level.notify_method}. Severity: ${severity || "warning"}.${incident_id ? ` Incident: ${incident_id}` : ""}`,
          type: "escalation",
          severity: severity || "warning",
          metadata: {
            policy_id,
            level_id: level.id,
            level_order: level.level_order,
            target_name: targetName,
            target_email: targetEmail,
            notify_method: level.notify_method,
            incident_id,
          },
        });

        results.push({
          level: level.level_order + 1,
          method: level.notify_method,
          target: targetName,
          status: "delivered_in_app",
        });
      }

      if (level.notify_method === "webhook") {
        // Use existing webhook infrastructure - fire send-webhook for the user
        const { data: webhooks } = await admin
          .from("webhook_configs")
          .select("*")
          .eq("user_id", user_id)
          .eq("enabled", true)
          .contains("events", ["escalation"]);

        if (webhooks?.length) {
          // Call send-webhook function
          try {
            await fetch(`${supabaseUrl}/functions/v1/send-webhook`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${serviceRoleKey}`,
              },
              body: JSON.stringify({
                event_type: "escalation",
                title: `Escalation L${level.level_order + 1}: ${incident_title}`,
                message: `Notifying ${targetName}. Timeout: ${level.timeout_minutes}min.`,
                severity: severity || "warning",
                user_id,
                metadata: {
                  policy_name: policy.name,
                  level_order: level.level_order,
                  target_name: targetName,
                  incident_id,
                },
              }),
            });
          } catch (_e) {
            // Webhook delivery is best-effort
          }
        }

        // Also create in-app notification
        await admin.from("notifications").insert({
          user_id,
          title: `🚨 Escalation L${level.level_order + 1}: ${incident_title}`,
          message: `Webhook notification sent for ${targetName}. Severity: ${severity || "warning"}.`,
          type: "escalation",
          severity: severity || "warning",
          metadata: { policy_id, level_id: level.id, notify_method: "webhook", incident_id },
        });

        results.push({
          level: level.level_order + 1,
          method: "webhook",
          target: targetName,
          status: "webhook_sent",
        });
      }

      // For SMS - log as in-app since we don't have an SMS provider
      if (level.notify_method === "sms") {
        await admin.from("notifications").insert({
          user_id,
          title: `🚨 Escalation L${level.level_order + 1}: ${incident_title}`,
          message: `SMS to ${targetName} (${targetEmail || "no number"}). Connect an SMS provider for delivery.`,
          type: "escalation",
          severity: severity || "warning",
          metadata: { policy_id, level_id: level.id, notify_method: "sms", incident_id },
        });

        results.push({
          level: level.level_order + 1,
          method: "sms",
          target: targetName,
          status: "logged_no_provider",
        });
      }
    }

    return new Response(JSON.stringify({ notified: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
