import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Fetch all schedules
    const { data: schedules, error: schedErr } = await admin
      .from("oncall_schedules")
      .select("*");

    if (schedErr) throw schedErr;
    if (!schedules?.length) {
      return new Response(JSON.stringify({ rotated: 0, message: "No schedules" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    let rotated = 0;

    for (const schedule of schedules) {
      const lastRotated = new Date(schedule.last_rotated_at || schedule.created_at);
      const daysSince = (now.getTime() - lastRotated.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSince < schedule.rotation_interval_days) continue;

      // Get member count for this schedule
      const { count } = await admin
        .from("oncall_members")
        .select("*", { count: "exact", head: true })
        .eq("schedule_id", schedule.id);

      if (!count || count === 0) continue;

      const newIndex = (schedule.current_index + 1) % count;

      await admin
        .from("oncall_schedules")
        .update({ current_index: newIndex, last_rotated_at: now.toISOString() })
        .eq("id", schedule.id);

      // Get the new on-call member for notification
      const { data: members } = await admin
        .from("oncall_members")
        .select("*")
        .eq("schedule_id", schedule.id)
        .order("position")
        .range(newIndex, newIndex);

      if (members?.[0]) {
        // Create in-app notification for the schedule owner
        await admin.from("notifications").insert({
          user_id: schedule.user_id,
          title: `On-call rotation: ${schedule.name}`,
          message: `${members[0].member_name} is now on call.`,
          type: "oncall",
          severity: "info",
        });
      }

      rotated++;
    }

    return new Response(JSON.stringify({ rotated, total: schedules.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
