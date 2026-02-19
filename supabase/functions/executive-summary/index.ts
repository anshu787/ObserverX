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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userId = claimsData.claims.sub;

    // Calculate date range (last 7 days)
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekAgoISO = weekAgo.toISOString();

    // Fetch all data in parallel
    const [serversRes, servicesRes, incidentsRes, alertsRes, metricsRes] = await Promise.all([
      supabase.from("servers").select("id, name, status, health_score").eq("user_id", userId),
      supabase.from("services").select("id, name, status, health_score, type").eq("user_id", userId),
      supabase.from("incidents").select("id, title, severity, status, started_at, resolved_at, ai_analysis, description")
        .eq("user_id", userId).gte("started_at", weekAgoISO).order("started_at", { ascending: false }),
      supabase.from("alerts").select("id, name, severity, status, triggered_at")
        .eq("user_id", userId).gte("triggered_at", weekAgoISO),
      supabase.from("metrics").select("metric_type, value, recorded_at")
        .gte("recorded_at", weekAgoISO).order("recorded_at", { ascending: false }).limit(500),
    ]);

    const servers = serversRes.data || [];
    const services = servicesRes.data || [];
    const incidents = incidentsRes.data || [];
    const alerts = alertsRes.data || [];
    const metrics = metricsRes.data || [];

    // Compute stats
    const totalServers = servers.length;
    const healthyServers = servers.filter((s: any) => s.status === "healthy").length;
    const avgHealthScore = servers.length > 0
      ? Math.round(servers.reduce((sum: number, s: any) => sum + (s.health_score || 0), 0) / servers.length)
      : 100;

    const totalIncidents = incidents.length;
    const criticalIncidents = incidents.filter((i: any) => i.severity === "critical").length;
    const resolvedIncidents = incidents.filter((i: any) => i.status === "resolved").length;
    const activeIncidents = incidents.filter((i: any) => i.status === "active").length;

    // Calculate MTTR (Mean Time To Resolve) in minutes
    const resolvedWithTimes = incidents.filter((i: any) => i.resolved_at && i.started_at);
    const mttrMinutes = resolvedWithTimes.length > 0
      ? Math.round(resolvedWithTimes.reduce((sum: number, i: any) => {
          return sum + (new Date(i.resolved_at).getTime() - new Date(i.started_at).getTime()) / 60000;
        }, 0) / resolvedWithTimes.length)
      : 0;

    // Total downtime minutes
    const totalDowntimeMinutes = resolvedWithTimes.reduce((sum: number, i: any) => {
      return sum + (new Date(i.resolved_at).getTime() - new Date(i.started_at).getTime()) / 60000;
    }, 0);
    // Add ongoing incidents
    const ongoingDowntime = incidents
      .filter((i: any) => !i.resolved_at)
      .reduce((sum: number, i: any) => sum + (now.getTime() - new Date(i.started_at).getTime()) / 60000, 0);
    const totalDowntime = Math.round(totalDowntimeMinutes + ongoingDowntime);

    // Uptime percentage (out of 7 days = 10080 minutes)
    const totalMinutesInWeek = 7 * 24 * 60;
    const uptimePercent = totalServers > 0
      ? Math.round((1 - totalDowntime / totalMinutesInWeek) * 10000) / 100
      : 100;

    const totalAlerts = alerts.length;
    const criticalAlerts = alerts.filter((a: any) => a.severity === "critical").length;

    // Avg metrics
    const cpuMetrics = metrics.filter((m: any) => m.metric_type === "cpu");
    const avgCpu = cpuMetrics.length > 0
      ? Math.round(cpuMetrics.reduce((s: number, m: any) => s + m.value, 0) / cpuMetrics.length * 10) / 10
      : 0;
    const errorMetrics = metrics.filter((m: any) => m.metric_type === "error_rate");
    const avgErrorRate = errorMetrics.length > 0
      ? Math.round(errorMetrics.reduce((s: number, m: any) => s + m.value, 0) / errorMetrics.length * 100) / 100
      : 0;
    const latencyMetrics = metrics.filter((m: any) => m.metric_type === "latency");
    const avgLatency = latencyMetrics.length > 0
      ? Math.round(latencyMetrics.reduce((s: number, m: any) => s + m.value, 0) / latencyMetrics.length)
      : 0;

    // Estimated cost impact ($150/hr average downtime cost)
    const costPerHour = 150;
    const estimatedCost = Math.round(totalDowntime / 60 * costPerHour);

    // Build context for AI summary
    const statsContext = {
      period: `${weekAgo.toISOString().split("T")[0]} to ${now.toISOString().split("T")[0]}`,
      totalServers, healthyServers, avgHealthScore,
      totalIncidents, criticalIncidents, resolvedIncidents, activeIncidents,
      mttrMinutes, totalDowntime, uptimePercent,
      totalAlerts, criticalAlerts,
      avgCpu, avgErrorRate, avgLatency,
      estimatedCost,
      topIncidents: incidents.slice(0, 5).map((i: any) => ({
        title: i.title, severity: i.severity, status: i.status,
      })),
    };

    // Generate AI executive summary
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are an expert SRE writing a weekly executive reliability report for ObserveX. 
Write a professional, concise report using the provided stats. Use the generate_report tool.
- executive_summary: 2-3 sentence high-level overview for C-level executives
- highlights: Array of 3-5 positive achievements or improvements
- concerns: Array of 1-4 areas needing attention (or empty if all clear)
- recommendations: Array of 2-4 actionable recommendations for the coming week
- risk_level: overall risk assessment (low/medium/high/critical)
- sla_status: whether SLA targets are being met (met/at_risk/breached)`,
          },
          {
            role: "user",
            content: `Generate the weekly reliability report based on these stats:\n${JSON.stringify(statsContext, null, 2)}`,
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "generate_report",
            description: "Generate structured executive reliability report",
            parameters: {
              type: "object",
              properties: {
                executive_summary: { type: "string" },
                highlights: { type: "array", items: { type: "string" } },
                concerns: { type: "array", items: { type: "string" } },
                recommendations: { type: "array", items: { type: "string" } },
                risk_level: { type: "string", enum: ["low", "medium", "high", "critical"] },
                sla_status: { type: "string", enum: ["met", "at_risk", "breached"] },
              },
              required: ["executive_summary", "highlights", "concerns", "recommendations", "risk_level", "sla_status"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "generate_report" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI report generation failed");
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    let aiReport;

    if (toolCall?.function?.arguments) {
      aiReport = JSON.parse(toolCall.function.arguments);
    } else {
      aiReport = {
        executive_summary: "Report generation unavailable.",
        highlights: [], concerns: [], recommendations: [],
        risk_level: "medium", sla_status: "at_risk",
      };
    }

    return new Response(JSON.stringify({
      stats: statsContext,
      report: aiReport,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("executive-summary error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
