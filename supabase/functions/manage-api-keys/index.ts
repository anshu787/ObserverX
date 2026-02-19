import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RATE_LIMIT_MAX = 5; // max key generations per hour
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const { action, name, key_id } = await req.json();
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const logAudit = async (actionName: string, resourceType: string, resourceId?: string, details?: Record<string, unknown>) => {
      await adminClient.from("audit_log").insert({
        user_id: user.id,
        action: actionName,
        resource_type: resourceType,
        resource_id: resourceId || null,
        details: details || {},
      });
    };

    if (action === "generate") {
      // Rate limiting check
      const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
      const { count } = await adminClient
        .from("rate_limits")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("action", "generate_api_key")
        .gte("created_at", windowStart);

      if ((count ?? 0) >= RATE_LIMIT_MAX) {
        await logAudit("api_key_generate_rate_limited", "api_key", undefined, { limit: RATE_LIMIT_MAX });
        return new Response(JSON.stringify({ error: `Rate limit exceeded. Maximum ${RATE_LIMIT_MAX} keys per hour.` }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Record rate limit entry
      await adminClient.from("rate_limits").insert({ user_id: user.id, action: "generate_api_key" });

      // Generate key
      const rawBytes = new Uint8Array(32);
      crypto.getRandomValues(rawBytes);
      const rawKey = Array.from(rawBytes).map(b => b.toString(16).padStart(2, '0')).join('');
      const apiKey = `obx_${rawKey}`;
      const prefix = apiKey.slice(0, 12) + "...";

      const encoder = new TextEncoder();
      const data = encoder.encode(apiKey);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const keyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      const { data: insertData, error: insertError } = await adminClient.from("api_keys").insert({
        user_id: user.id,
        name: name || "Unnamed Key",
        key_prefix: prefix,
        key_hash: keyHash,
      }).select("id").single();

      if (insertError) throw insertError;

      await logAudit("api_key_generated", "api_key", insertData?.id, { name: name || "Unnamed Key", prefix });

      return new Response(JSON.stringify({ key: apiKey, prefix }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "revoke") {
      const { error: revokeError } = await adminClient
        .from("api_keys")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", key_id)
        .eq("user_id", user.id);

      if (revokeError) throw revokeError;

      await logAudit("api_key_revoked", "api_key", key_id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      const { error: deleteError } = await adminClient
        .from("api_keys")
        .delete()
        .eq("id", key_id)
        .eq("user_id", user.id);

      if (deleteError) throw deleteError;

      await logAudit("api_key_deleted", "api_key", key_id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Invalid action");
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
