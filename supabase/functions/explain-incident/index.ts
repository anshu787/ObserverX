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

    const { incidentId } = await req.json();
    if (!incidentId) {
      return new Response(JSON.stringify({ error: "incidentId required" }), { status: 400, headers: corsHeaders });
    }

    // Fetch incident
    const { data: incident, error: incidentError } = await supabase
      .from("incidents")
      .select("*")
      .eq("id", incidentId)
      .eq("user_id", userId)
      .maybeSingle();

    if (incidentError || !incident) {
      return new Response(JSON.stringify({ error: "Incident not found" }), { status: 404, headers: corsHeaders });
    }

    // Fetch recent logs, metrics, and alerts for rich context
    const [logsRes, alertsRes, metricsRes, eventsRes] = await Promise.all([
      supabase.from("logs").select("severity, message, timestamp, source")
        .in("severity", ["error", "critical"]).order("timestamp", { ascending: false }).limit(15),
      supabase.from("alerts").select("name, severity, message, condition")
        .eq("user_id", userId).eq("status", "active").limit(10),
      supabase.from("metrics").select("metric_type, value, unit, recorded_at")
        .order("recorded_at", { ascending: false }).limit(20),
      supabase.from("incident_events").select("event_type, title, description, severity, occurred_at")
        .eq("incident_id", incidentId).order("occurred_at", { ascending: true }),
    ]);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are an expert DevOps/SRE AI assistant for the ObserveX monitoring platform. Analyze incidents and provide structured root cause analysis with confidence scoring and evidence.

Given an incident with its context (logs, metrics, alerts, timeline events), you must return a structured analysis using the suggest_analysis tool with:
- summary: Plain English explanation of what happened (2-3 sentences)
- root_cause: Technical root cause analysis (2-3 sentences)
- confidence: Integer 0-100 representing how confident you are in the root cause (based on evidence quality)
- evidence: Array of strings, each describing a piece of supporting evidence (e.g. "CPU increased 240%", "Error logs matched DB timeout pattern")
- changes_detected: Array of strings describing what changed before the failure (e.g. "New deployment detected", "Config update", "Traffic spike 3x normal")
- affected_services: List of likely affected service names
- fix_steps: 3-5 actionable steps to resolve the issue (imperative, like "Restart auth-service", "Rollback last deployment")
- severity_assessment: Your assessment of true severity (info/warning/critical)
- failure_risk: Integer 0-100 representing ongoing risk of further failures
- estimated_recovery_minutes: Estimated minutes to recover if fix steps are followed

Be specific in evidence and changes. Reference actual metric values, log messages, and timestamps when available. Higher confidence when more evidence aligns.`;

    const userPrompt = `Analyze this incident:
Title: ${incident.title}
Description: ${incident.description || "No description"}
Severity: ${incident.severity}
Status: ${incident.status}
Started: ${incident.started_at}
${incident.resolved_at ? `Resolved: ${incident.resolved_at}` : "Still active"}

Timeline events: ${JSON.stringify(eventsRes.data || [])}
Recent error logs: ${JSON.stringify(logsRes.data || [])}
Active alerts: ${JSON.stringify(alertsRes.data || [])}
Recent metrics: ${JSON.stringify(metricsRes.data || [])}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "suggest_analysis",
            description: "Return structured incident analysis with confidence and evidence",
            parameters: {
              type: "object",
              properties: {
                summary: { type: "string" },
                root_cause: { type: "string" },
                confidence: { type: "integer", minimum: 0, maximum: 100 },
                evidence: { type: "array", items: { type: "string" } },
                changes_detected: { type: "array", items: { type: "string" } },
                affected_services: { type: "array", items: { type: "string" } },
                fix_steps: { type: "array", items: { type: "string" } },
                severity_assessment: { type: "string", enum: ["info", "warning", "critical"] },
                failure_risk: { type: "integer", minimum: 0, maximum: 100 },
                estimated_recovery_minutes: { type: "integer" },
              },
              required: ["summary", "root_cause", "confidence", "evidence", "changes_detected", "affected_services", "fix_steps", "severity_assessment", "failure_risk", "estimated_recovery_minutes"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "suggest_analysis" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI analysis failed");
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    let analysis;
    
    if (toolCall?.function?.arguments) {
      analysis = JSON.parse(toolCall.function.arguments);
    } else {
      analysis = {
        summary: "Analysis could not be generated.",
        root_cause: "Unknown",
        confidence: 0,
        evidence: [],
        changes_detected: [],
        affected_services: [],
        fix_steps: ["Review logs manually"],
        severity_assessment: incident.severity,
        failure_risk: 50,
        estimated_recovery_minutes: 30,
      };
    }

    // Update incident with AI analysis
    await supabase
      .from("incidents")
      .update({ ai_analysis: analysis })
      .eq("id", incidentId);

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("explain-incident error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
