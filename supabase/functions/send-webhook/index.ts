import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function isSlackWebhookUrl(url: string): boolean {
  return url.includes("hooks.slack.com") || url.includes("slack.com/api");
}

function severityToEmoji(severity: string): string {
  switch (severity) {
    case "critical": return "🔴";
    case "error": return "🔴";
    case "warning": return "🟡";
    case "info": return "🔵";
    default: return "⚪";
  }
}

function severityToColor(severity: string): string {
  switch (severity) {
    case "critical": return "#dc2626";
    case "error": return "#dc2626";
    case "warning": return "#f59e0b";
    case "info": return "#3b82f6";
    default: return "#6b7280";
  }
}

function buildSlackBlocks(payload: {
  event: string;
  title: string;
  message: string;
  severity: string;
  metadata: Record<string, any>;
  timestamp: string;
}) {
  const emoji = severityToEmoji(payload.severity);
  const color = severityToColor(payload.severity);
  const eventLabel = payload.event.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  const fields: { type: string; text: string }[] = [
    { type: "mrkdwn", text: `*Event:*\n${eventLabel}` },
    { type: "mrkdwn", text: `*Severity:*\n${emoji} ${payload.severity.toUpperCase()}` },
  ];

  if (payload.metadata?.server_name) {
    fields.push({ type: "mrkdwn", text: `*Server:*\n${payload.metadata.server_name}` });
  }
  if (payload.metadata?.metric_type) {
    fields.push({ type: "mrkdwn", text: `*Metric:*\n${payload.metadata.metric_type}` });
  }
  if (payload.metadata?.minutes_until) {
    fields.push({ type: "mrkdwn", text: `*ETA:*\n~${payload.metadata.minutes_until} min` });
  }
  if (payload.metadata?.current_value !== undefined) {
    fields.push({ type: "mrkdwn", text: `*Current:*\n${payload.metadata.current_value}` });
  }

  return {
    attachments: [
      {
        color,
        blocks: [
          { type: "header", text: { type: "plain_text", text: `${emoji} ${payload.title}`, emoji: true } },
          { type: "section", text: { type: "mrkdwn", text: payload.message || "_No details_" } },
          { type: "section", fields },
          { type: "context", elements: [{ type: "mrkdwn", text: `ObserveX • ${new Date(payload.timestamp).toLocaleString()}` }] },
        ],
      },
    ],
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { event_type, title, message, severity, user_id, metadata, retry_delivery_id, max_retries } = await req.json();
    const MAX_RETRIES = Math.min(max_retries || 3, 5);
    const BASE_DELAY_MS = 1000; // 1s, 2s, 4s exponential backoff
    if (!user_id || !event_type || !title) {
      throw new Error("Missing required fields: user_id, event_type, title");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // If retrying a specific delivery, fetch that webhook only
    let webhooksToDeliver: any[] = [];
    let retryAttempt = 1;

    if (retry_delivery_id) {
      const { data: log } = await supabase
        .from("webhook_delivery_logs")
        .select("*, webhook_configs(*)")
        .eq("id", retry_delivery_id)
        .single();
      if (log?.webhook_configs) {
        webhooksToDeliver = [log.webhook_configs];
        retryAttempt = (log.attempt || 1) + 1;
      }
    } else {
      const { data: webhooks } = await supabase
        .from("webhook_configs")
        .select("*")
        .eq("user_id", user_id)
        .eq("enabled", true)
        .contains("events", [event_type]);
      webhooksToDeliver = webhooks || [];
    }

    if (!webhooksToDeliver.length) {
      return new Response(JSON.stringify({ delivered: 0, message: "No matching webhooks" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const genericPayload = {
      event: event_type,
      title,
      message: message || "",
      severity: severity || "info",
      metadata: metadata || {},
      timestamp: new Date().toISOString(),
    };

    const results = await Promise.allSettled(
      webhooksToDeliver.map(async (wh: any) => {
        const isSlack = isSlackWebhookUrl(wh.url);
        const body = isSlack ? buildSlackBlocks(genericPayload) : genericPayload;

        const reqHeaders: Record<string, string> = { "Content-Type": "application/json" };
        if (!isSlack && wh.secret) {
          const encoder = new TextEncoder();
          const key = await crypto.subtle.importKey(
            "raw", encoder.encode(wh.secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
          );
          const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(JSON.stringify(body)));
          const hex = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, "0")).join("");
          reqHeaders["X-Webhook-Signature"] = `sha256=${hex}`;
        }

        let statusCode = 0;
        let success = false;
        let errorMessage: string | null = null;
        let attempt = retryAttempt;

        // Retry loop with exponential backoff
        for (let i = 0; i < MAX_RETRIES; i++) {
          attempt = retryAttempt + i;
          statusCode = 0;
          success = false;
          errorMessage = null;

          try {
            const resp = await fetch(wh.url, { method: "POST", headers: reqHeaders, body: JSON.stringify(body) });
            statusCode = resp.status;
            success = resp.ok;
            if (!resp.ok) errorMessage = `HTTP ${resp.status}`;
          } catch (fetchErr: any) {
            errorMessage = fetchErr.message || "Connection failed";
          }

          // Log each attempt
          await supabase.from("webhook_delivery_logs").insert({
            webhook_id: wh.id,
            user_id,
            event_type,
            payload: genericPayload,
            status_code: statusCode || null,
            success,
            error_message: errorMessage,
            attempt,
          });

          if (success) break;

          // Don't retry on 4xx client errors (except 429 rate limit)
          if (statusCode >= 400 && statusCode < 500 && statusCode !== 429) break;

          // Exponential backoff before next retry
          if (i < MAX_RETRIES - 1) {
            const delay = BASE_DELAY_MS * Math.pow(2, i);
            await new Promise((r) => setTimeout(r, delay));
          }
        }

        return { webhook_id: wh.id, name: wh.name, status: statusCode, ok: success, slack: isSlack, error: errorMessage, attempts: attempt };
      })
    );

    const delivered = results.filter((r) => r.status === "fulfilled" && (r.value as any).ok).length;

    return new Response(JSON.stringify({ delivered, total: results.length, results: results.map((r) => r.status === "fulfilled" ? r.value : { error: (r as any).reason?.message }) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
