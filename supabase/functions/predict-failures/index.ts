import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MetricPoint {
  value: number;
  recorded_at: string;
  metric_type: string;
}

function linearRegression(points: { x: number; y: number }[]) {
  const n = points.length;
  if (n < 3) return null;
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return null;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

function predictTimeToThreshold(
  metrics: MetricPoint[],
  threshold: number,
  metricType: string
): { minutesUntil: number; currentValue: number; trend: string } | null {
  if (metrics.length < 5) return null;

  const baseTime = new Date(metrics[metrics.length - 1].recorded_at).getTime();
  const points = metrics.map((m) => ({
    x: (new Date(m.recorded_at).getTime() - baseTime) / 60000, // minutes
    y: m.value,
  }));

  const reg = linearRegression(points);
  if (!reg || reg.slope <= 0) return null; // only predict if trending up

  const currentValue = points[points.length - 1].y;
  if (currentValue >= threshold) return null; // already exceeded

  const minutesUntil = (threshold - reg.intercept - reg.slope * points[points.length - 1].x) / reg.slope;
  if (minutesUntil <= 0 || minutesUntil > 120) return null; // only warn within 2 hours

  const trend = reg.slope > 0.5 ? "rapidly increasing" : "steadily increasing";
  return { minutesUntil: Math.round(minutesUntil), currentValue: Math.round(currentValue * 10) / 10, trend };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader! } },
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    // Get all servers
    const { data: servers } = await supabase.from("servers").select("id, name").eq("user_id", user.id);
    if (!servers?.length) {
      return new Response(JSON.stringify({ predictions: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const thresholds: Record<string, { threshold: number; unit: string; label: string }> = {
      cpu: { threshold: 95, unit: "%", label: "CPU exhaustion" },
      memory: { threshold: 95, unit: "%", label: "Memory exhaustion" },
      disk: { threshold: 90, unit: "%", label: "Disk full" },
      error_rate: { threshold: 10, unit: "%", label: "Error rate critical" },
      latency: { threshold: 500, unit: "ms", label: "Latency critical" },
    };

    const predictions: any[] = [];

    for (const server of servers) {
      for (const [metricType, config] of Object.entries(thresholds)) {
        const { data: metrics } = await supabase
          .from("metrics")
          .select("value, recorded_at, metric_type")
          .eq("server_id", server.id)
          .eq("metric_type", metricType)
          .order("recorded_at", { ascending: true })
          .limit(20);

        if (!metrics?.length) continue;

        const prediction = predictTimeToThreshold(metrics, config.threshold, metricType);
        if (prediction) {
          predictions.push({
            server_id: server.id,
            server_name: server.name,
            metric_type: metricType,
            label: config.label,
            unit: config.unit,
            ...prediction,
          });
        }
      }
    }

    // Generate AI-enhanced messages for predictions using Lovable AI
    if (predictions.length > 0) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (LOVABLE_API_KEY) {
        try {
          const prompt = predictions.map((p) =>
            `${p.server_name}: ${p.label} expected in ~${p.minutesUntil} min (current: ${p.currentValue}${p.unit}, ${p.trend})`
          ).join("\n");

          const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [
                { role: "system", content: "You are a DevOps AI assistant. For each prediction, provide a brief actionable recommendation in 1 sentence. Return a JSON array of objects with fields: metric_type, recommendation." },
                { role: "user", content: prompt },
              ],
            }),
          });

          if (aiResp.ok) {
            const aiData = await aiResp.json();
            const content = aiData.choices?.[0]?.message?.content || "";
            try {
              const jsonMatch = content.match(/\[[\s\S]*\]/);
              if (jsonMatch) {
                const recommendations = JSON.parse(jsonMatch[0]);
                for (const rec of recommendations) {
                  const pred = predictions.find((p) => p.metric_type === rec.metric_type);
                  if (pred) pred.recommendation = rec.recommendation;
                }
              }
            } catch { /* AI parsing failed, predictions still work without recommendations */ }
          }
        } catch { /* AI call failed, predictions still work */ }
      }
    }

    // Insert notifications for critical predictions (within 30 min)
    const criticalPredictions = predictions.filter((p) => p.minutesUntil <= 30);
    if (criticalPredictions.length > 0) {
      const notifications = criticalPredictions.map((p) => ({
        user_id: user.id,
        type: "prediction",
        title: `⚠️ ${p.label} predicted`,
        message: `${p.server_name}: ${p.label} expected in ~${p.minutesUntil} min. Current: ${p.currentValue}${p.unit} (${p.trend}).${p.recommendation ? " " + p.recommendation : ""}`,
        severity: p.minutesUntil <= 10 ? "critical" : "warning",
        metadata: { server_id: p.server_id, metric_type: p.metric_type, minutes_until: p.minutesUntil },
      }));
      await supabase.from("notifications").insert(notifications);

      // Fire webhooks for each critical prediction
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      for (const p of criticalPredictions) {
        try {
          await fetch(`${supabaseUrl}/functions/v1/send-webhook`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${anonKey}` },
            body: JSON.stringify({
              event_type: "prediction",
              title: `${p.label} predicted on ${p.server_name}`,
              message: `${p.server_name}: ${p.label} expected in ~${p.minutesUntil} min. Current: ${p.currentValue}${p.unit} (${p.trend}).${p.recommendation || ""}`,
              severity: p.minutesUntil <= 10 ? "critical" : "warning",
              user_id: user.id,
              metadata: { server_name: p.server_name, metric_type: p.metric_type, minutes_until: p.minutesUntil, current_value: `${p.currentValue}${p.unit}` },
            }),
          });
        } catch { /* best-effort */ }
      }
    }

    return new Response(JSON.stringify({ predictions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
