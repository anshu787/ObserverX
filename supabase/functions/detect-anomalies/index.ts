import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const token = authHeader.replace("Bearer ", "");
    let userIds: string[] = [];
    let isScheduled = false;

    // Try to authenticate as a user first
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claimsData } = await supabase.auth.getClaims(token);
    
    if (claimsData?.claims?.sub) {
      userIds = [claimsData.claims.sub as string];
    } else {
      // Scheduled/cron call - scan all users with servers
      isScheduled = true;
      const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: serverUsers } = await adminClient.from("servers").select("user_id");
      userIds = [...new Set((serverUsers || []).map((s: any) => s.user_id))];
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let totalAnomalies = 0;
    let totalIncidents = 0;

    for (const userId of userIds) {
      const { data: servers } = await adminClient.from("servers").select("id, name").eq("user_id", userId);
      if (!servers?.length) continue;

      const windowStart = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { data: metrics } = await adminClient
        .from("metrics")
        .select("metric_type, value, recorded_at, server_id")
        .in("server_id", servers.map((s: any) => s.id))
        .gte("recorded_at", windowStart)
        .order("recorded_at", { ascending: true });

      if (!metrics?.length) continue;

      const grouped: Record<string, { values: number[]; server_id: string }> = {};
      for (const m of metrics) {
        const key = `${m.metric_type}_${m.server_id}`;
        if (!grouped[key]) grouped[key] = { values: [], server_id: m.server_id };
        grouped[key].values.push(m.value);
      }

      const metricSummary = Object.entries(grouped).map(([key, data]) => {
        const [metricType] = key.split("_");
        const serverName = servers.find((s: any) => s.id === data.server_id)?.name || "unknown";
        const avg = data.values.reduce((a, b) => a + b, 0) / data.values.length;
        const max = Math.max(...data.values);
        const min = Math.min(...data.values);
        const recent = data.values.slice(-5);
        const trend = recent.length > 1 ? (recent[recent.length - 1] - recent[0]) : 0;
        return { metricType, serverName, avg: Math.round(avg * 10) / 10, max: Math.round(max * 10) / 10, min: Math.round(min * 10) / 10, trend: Math.round(trend * 10) / 10, dataPoints: data.values.length };
      });

      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) continue;

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: `You are an infrastructure anomaly detection system. Analyze metric data and identify anomalies.
Return results using the detect_anomalies tool. Thresholds:
- CPU > 80% sustained = anomaly, Memory > 85% = anomaly, Latency > 200ms = anomaly
- Error rate > 3% = anomaly, Rapid trend changes (>20 point swing) = anomaly, Disk > 90% = anomaly
Be conservative - only flag genuine concerns.`,
            },
            { role: "user", content: `Analyze metrics from the last 30 minutes:\n${JSON.stringify(metricSummary, null, 2)}` },
          ],
          tools: [{
            type: "function",
            function: {
              name: "detect_anomalies",
              description: "Report detected anomalies",
              parameters: {
                type: "object",
                properties: {
                  anomalies: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        severity: { type: "string", enum: ["warning", "critical"] },
                        metric: { type: "string" },
                        server: { type: "string" },
                        title: { type: "string" },
                        description: { type: "string" },
                        recommendation: { type: "string" },
                      },
                      required: ["severity", "metric", "server", "title", "description", "recommendation"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["anomalies"],
                additionalProperties: false,
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "detect_anomalies" } },
        }),
      });

      if (!aiResponse.ok) {
        console.error("AI error for user", userId, aiResponse.status);
        continue;
      }

      const aiData = await aiResponse.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      let anomalies: any[] = [];
      if (toolCall?.function?.arguments) {
        try {
          const parsed = JSON.parse(toolCall.function.arguments);
          anomalies = parsed.anomalies || [];
        } catch { /* empty */ }
      }

      totalAnomalies += anomalies.length;

      for (const anomaly of anomalies) {
        if (anomaly.severity === "critical") {
          const { data: incident } = await adminClient.from("incidents").insert({
            user_id: userId,
            title: `[AI] ${anomaly.title}`,
            description: `${anomaly.description}\n\nRecommendation: ${anomaly.recommendation}`,
            severity: "critical",
            status: "active",
            ai_analysis: { anomaly, source: "anomaly-detection", detected_at: new Date().toISOString() },
          }).select("id").single();
          totalIncidents++;

          // Trigger matching runbooks
          if (incident) {
            try {
              await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/execute-runbook`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
                body: JSON.stringify({ user_id: userId, incident_id: incident.id, anomaly }),
              });
            } catch { /* best effort */ }
          }
        }

        await adminClient.from("alerts").insert({
          user_id: userId,
          name: `[AI] ${anomaly.title}`,
          condition: { metric: anomaly.metric, server: anomaly.server, source: "ai-anomaly-detection" },
          severity: anomaly.severity,
          status: "active",
          message: anomaly.description,
          ai_message: anomaly.recommendation,
        });

        // Send webhook for critical anomalies
        if (anomaly.severity === "critical") {
          try {
            await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-webhook`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}` },
              body: JSON.stringify({
                event_type: "alert",
                title: `[AI Anomaly] ${anomaly.title}`,
                message: `${anomaly.description}\n\nRecommendation: ${anomaly.recommendation}`,
                severity: "critical",
                user_id: userId,
                metadata: { metric: anomaly.metric, server: anomaly.server, source: "scheduled-anomaly-detection" },
              }),
            });
          } catch { /* best effort */ }
        }
      }
    }

    return new Response(JSON.stringify({ anomalies: totalAnomalies, incidentsCreated: totalIncidents, usersScanned: userIds.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("detect-anomalies error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
