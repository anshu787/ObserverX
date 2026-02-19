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
    const userId = claimsData.claims.sub as string;

    // Get or create demo server
    let { data: servers } = await supabase.from("servers").select("id").eq("user_id", userId).limit(1);
    let serverId: string;

    if (!servers?.length) {
      const { data: newServer } = await supabase.from("servers").insert({
        user_id: userId, name: "prod-web-01", hostname: "prod-web-01.observex.cloud", ip_address: "10.0.1.42",
        status: "healthy", health_score: 92,
      }).select("id").single();
      serverId = newServer!.id;

      // Create a second server
      const { data: s2 } = await supabase.from("servers").insert({
        user_id: userId, name: "prod-db-01", hostname: "prod-db-01.observex.cloud", ip_address: "10.0.2.15",
        status: "healthy", health_score: 88,
      }).select("id").single();

      // Create services
      const serviceData = [
        { user_id: userId, name: "Frontend", type: "frontend", status: "healthy", health_score: 98, server_id: serverId },
        { user_id: userId, name: "API Gateway", type: "gateway", status: "healthy", health_score: 95, server_id: serverId },
        { user_id: userId, name: "User API", type: "api", status: "healthy", health_score: 90, server_id: serverId },
        { user_id: userId, name: "Auth Service", type: "auth", status: "healthy", health_score: 97, server_id: serverId },
        { user_id: userId, name: "PostgreSQL", type: "database", status: "healthy", health_score: 85, server_id: s2!.id },
        { user_id: userId, name: "Redis Cache", type: "cache", status: "healthy", health_score: 99, server_id: s2!.id },
      ];
      const { data: services } = await supabase.from("services").insert(serviceData).select("id, type");

      if (services?.length) {
        const svcMap: Record<string, string> = {};
        services.forEach((s: any) => { svcMap[s.type] = s.id; });
        // Create dependencies
        const deps = [
          { user_id: userId, source_service_id: svcMap.frontend, target_service_id: svcMap.gateway },
          { user_id: userId, source_service_id: svcMap.gateway, target_service_id: svcMap.api },
          { user_id: userId, source_service_id: svcMap.gateway, target_service_id: svcMap.auth },
          { user_id: userId, source_service_id: svcMap.api, target_service_id: svcMap.database },
          { user_id: userId, source_service_id: svcMap.api, target_service_id: svcMap.cache },
          { user_id: userId, source_service_id: svcMap.auth, target_service_id: svcMap.database },
        ].filter((d) => d.source_service_id && d.target_service_id);
        if (deps.length) await supabase.from("service_dependencies").insert(deps);
      }
    } else {
      serverId = servers[0].id;
    }

    // Generate metrics for the past hour (every 30 seconds)
    const now = Date.now();
    const metrics: any[] = [];
    
    // Simulate a scenario: gradual CPU spike leading to latency increase
    const scenarioPhase = Math.random();
    const isSpike = scenarioPhase > 0.6; // 40% chance of spike scenario

    for (let i = 60; i >= 0; i--) {
      const ts = new Date(now - i * 30000).toISOString();
      const progress = (60 - i) / 60; // 0 to 1

      let cpuBase = 35 + Math.random() * 15;
      let memBase = 55 + Math.random() * 10;
      let diskBase = 40 + Math.random() * 5;
      let networkBase = 150 + Math.random() * 100;
      let latencyBase = 45 + Math.random() * 20;
      let errorBase = 0.2 + Math.random() * 0.5;

      if (isSpike && progress > 0.5) {
        const spikeIntensity = (progress - 0.5) * 2;
        cpuBase += spikeIntensity * 45;
        latencyBase += spikeIntensity * 250;
        memBase += spikeIntensity * 20;
        errorBase += spikeIntensity * 8;
      }

      metrics.push(
        { server_id: serverId, metric_type: "cpu", value: Math.min(cpuBase, 99), unit: "%", recorded_at: ts },
        { server_id: serverId, metric_type: "memory", value: Math.min(memBase, 98), unit: "%", recorded_at: ts },
        { server_id: serverId, metric_type: "disk", value: Math.min(diskBase, 95), unit: "%", recorded_at: ts },
        { server_id: serverId, metric_type: "network", value: networkBase, unit: "Mbps", recorded_at: ts },
        { server_id: serverId, metric_type: "latency", value: Math.min(latencyBase, 500), unit: "ms", recorded_at: ts },
        { server_id: serverId, metric_type: "error_rate", value: Math.min(errorBase, 15), unit: "%", recorded_at: ts },
      );
    }

    // Insert metrics in batches
    for (let b = 0; b < metrics.length; b += 100) {
      await supabase.from("metrics").insert(metrics.slice(b, b + 100));
    }

    // Generate logs
    const logMessages = [
      { severity: "info", message: "Request processed successfully", source: "api-gateway" },
      { severity: "info", message: "Cache hit for user session", source: "redis" },
      { severity: "info", message: "Health check passed", source: "load-balancer" },
      { severity: "warn", message: "Slow query detected: SELECT * FROM users WHERE... (340ms)", source: "postgresql" },
      { severity: "warn", message: "Connection pool utilization at 75%", source: "api-server" },
      { severity: "error", message: "Failed to connect to upstream service: timeout after 30s", source: "api-gateway" },
      { severity: "error", message: "Out of memory: Kill process node (pid=2847)", source: "system" },
      { severity: "critical", message: "Database connection pool exhausted, rejecting new connections", source: "postgresql" },
      { severity: "info", message: "Deployment v2.4.1 rolling out to production", source: "ci-cd" },
      { severity: "warn", message: "SSL certificate expires in 14 days", source: "nginx" },
      { severity: "error", message: "Unhandled promise rejection in /api/users/profile", source: "node" },
      { severity: "info", message: "Auto-scaling: adding 2 instances to web-pool", source: "orchestrator" },
    ];

    // We'll add trace correlation after generating traces
    const logEntriesRaw: any[] = [];
    for (let i = 0; i < 30; i++) {
      const msg = logMessages[Math.floor(Math.random() * logMessages.length)];
      logEntriesRaw.push({
        server_id: serverId,
        severity: msg.severity,
        message: msg.message,
        source: msg.source,
        timestamp: new Date(now - Math.random() * 3600000).toISOString(),
      });
    }

    // Create incident with timeline events if spike scenario
    if (isSpike) {
      const incidentStart = new Date(now - 1800000); // 30 min ago
      const { data: incident } = await supabase.from("incidents").insert({
        user_id: userId,
        title: "API Latency Spike Detected",
        description: "Elevated API response times correlated with CPU spike on prod-web-01. Error rate increased from 0.3% to 8.5%.",
        severity: "critical",
        status: "active",
        started_at: incidentStart.toISOString(),
      }).select("id").single();

      if (incident) {
        const events = [
          { incident_id: incident.id, event_type: "metric_spike", title: "CPU usage exceeded 80%", description: "prod-web-01 CPU jumped from 42% to 85% in 3 minutes", severity: "warning", occurred_at: new Date(now - 1800000).toISOString() },
          { incident_id: incident.id, event_type: "log_error", title: "Connection pool warnings", description: "PostgreSQL connection pool utilization hit 90%", severity: "warning", occurred_at: new Date(now - 1500000).toISOString() },
          { incident_id: incident.id, event_type: "metric_spike", title: "API latency crossed 300ms", description: "P95 latency increased from 65ms to 320ms", severity: "critical", occurred_at: new Date(now - 1200000).toISOString() },
          { incident_id: incident.id, event_type: "alert_triggered", title: "Critical alert: High error rate", description: "Error rate exceeded 5% threshold for 60 seconds", severity: "critical", occurred_at: new Date(now - 1100000).toISOString() },
          { incident_id: incident.id, event_type: "service_degraded", title: "User API marked degraded", description: "Health score dropped from 90 to 45", severity: "critical", occurred_at: new Date(now - 900000).toISOString() },
          { incident_id: incident.id, event_type: "status_change", title: "Incident escalated to investigating", description: "Auto-escalation triggered after 10 minutes", severity: "info", occurred_at: new Date(now - 600000).toISOString() },
        ];
        await supabase.from("incident_events").insert(events);

        // Also update services to show degraded state
        const { data: svcs } = await supabase.from("services").select("id, type").eq("user_id", userId);
        const apiSvc = svcs?.find((s: any) => s.type === "api");
        if (apiSvc) {
          await supabase.from("services").update({ status: "degraded", health_score: 45 }).eq("id", apiSvc.id);
        }
        const dbSvc = svcs?.find((s: any) => s.type === "database");
        if (dbSvc) {
          await supabase.from("services").update({ status: "degraded", health_score: 60 }).eq("id", dbSvc.id);
        }

        // Update server health
        await supabase.from("servers").update({ status: "degraded", health_score: 65 }).eq("id", serverId);
      }

    // Create alert
      await supabase.from("alerts").insert({
        user_id: userId,
        name: "CPU + Latency Correlation Alert",
        condition: { metric: "cpu", operator: ">", threshold: 80, correlation: { metric: "latency", operator: ">", threshold: 200 } },
        severity: "critical",
        status: "active",
        message: "CPU > 80% AND Latency > 200ms detected simultaneously",
        ai_message: "A CPU spike on prod-web-01 is causing elevated API response times. The correlation between CPU usage (85%) and P95 latency (320ms) suggests the application server is compute-bound, likely from a resource-intensive query or memory leak. Consider horizontal scaling or investigating recent deployments.",
      });

      // Fire webhook for the alert
      try {
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-webhook`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}` },
          body: JSON.stringify({
            event_type: "alert",
            title: "CPU + Latency Correlation Alert",
            message: "CPU > 80% AND Latency > 200ms detected simultaneously on prod-web-01",
            severity: "critical",
            user_id: userId,
            metadata: { server_name: "prod-web-01", metric_type: "cpu", current_value: "85%" },
          }),
        });
      } catch { /* webhook delivery is best-effort */ }

      // Fire webhook for the incident
      try {
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-webhook`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}` },
          body: JSON.stringify({
            event_type: "incident",
            title: "API Latency Spike Detected",
            message: "Elevated API response times correlated with CPU spike on prod-web-01. Error rate increased from 0.3% to 8.5%.",
            severity: "critical",
            user_id: userId,
            metadata: { server_name: "prod-web-01" },
          }),
        });
      } catch { /* webhook delivery is best-effort */ }
    }

    // Generate distributed traces
    const { data: svcsForTraces } = await supabase.from("services").select("id, name, type").eq("user_id", userId);
    if (svcsForTraces?.length) {
      const svcMap: Record<string, string> = {};
      svcsForTraces.forEach((s: any) => { svcMap[s.type] = s.id; });

      const traceTemplates = [
        {
          name: "GET /api/users/profile",
          spans: [
            { service: "gateway", op: "GET /api/users/profile", dur: [20, 80] },
            { service: "auth", op: "validateToken", dur: [5, 15], parent: 0 },
            { service: "api", op: "fetchUserProfile", dur: [10, 40], parent: 0 },
            { service: "database", op: "SELECT users", dur: [3, 20], parent: 2 },
            { service: "cache", op: "GET user:cache", dur: [1, 5], parent: 2 },
          ],
        },
        {
          name: "POST /api/orders",
          spans: [
            { service: "gateway", op: "POST /api/orders", dur: [30, 120] },
            { service: "auth", op: "validateToken", dur: [5, 15], parent: 0 },
            { service: "api", op: "createOrder", dur: [20, 80], parent: 0 },
            { service: "database", op: "INSERT orders", dur: [5, 30], parent: 2 },
            { service: "database", op: "UPDATE inventory", dur: [3, 20], parent: 2 },
          ],
        },
        {
          name: "GET /api/dashboard",
          spans: [
            { service: "gateway", op: "GET /api/dashboard", dur: [40, 200] },
            { service: "api", op: "aggregateMetrics", dur: [30, 150], parent: 0 },
            { service: "database", op: "SELECT metrics", dur: [10, 50], parent: 1 },
            { service: "cache", op: "GET dashboard:cache", dur: [1, 8], parent: 1 },
            { service: "api", op: "calculateHealth", dur: [5, 20], parent: 1 },
          ],
        },
      ];

      const traceEntries: any[] = [];
      for (let t = 0; t < 8; t++) {
        const template = traceTemplates[t % traceTemplates.length];
        const traceId = crypto.randomUUID();
        const traceStart = new Date(now - Math.random() * 3600000);
        const spanIds: string[] = [];
        const isErrorTrace = isSpike && t === 0;

        for (let si = 0; si < template.spans.length; si++) {
          const spanDef = template.spans[si];
          const svcId = svcMap[spanDef.service];
          if (!svcId) continue;

          const spanId = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
          spanIds.push(spanId);

          const baseDur = spanDef.dur[0] + Math.random() * (spanDef.dur[1] - spanDef.dur[0]);
          const duration = isErrorTrace ? baseDur * 3 : baseDur;
          const parentSpanId = spanDef.parent !== undefined ? spanIds[spanDef.parent] || null : null;
          const spanStart = new Date(traceStart.getTime() + si * 5);

          traceEntries.push({
            trace_id: traceId,
            span_id: spanId,
            parent_span_id: parentSpanId,
            operation_name: spanDef.op,
            service_id: svcId,
            duration_ms: Math.round(duration * 10) / 10,
            status: isErrorTrace && si >= 2 ? "error" : "ok",
            started_at: spanStart.toISOString(),
          });
        }
      }

      if (traceEntries.length > 0) {
        await supabase.from("traces").insert(traceEntries);

        // Correlate some logs with trace spans
        const traceIdsForCorrelation = [...new Set(traceEntries.map((t: any) => t.trace_id))].slice(0, 5);
        for (let li = 0; li < logEntriesRaw.length && li < traceIdsForCorrelation.length; li++) {
          const matchingSpans = traceEntries.filter((t: any) => t.trace_id === traceIdsForCorrelation[li]);
          if (matchingSpans.length > 0) {
            const span = matchingSpans[Math.floor(Math.random() * matchingSpans.length)];
            logEntriesRaw[li].trace_id = span.trace_id;
            logEntriesRaw[li].span_id = span.span_id;
          }
        }
      }
    }

    // Insert logs (some now have trace correlation)
    await supabase.from("logs").insert(logEntriesRaw);

    // Create default SLO definitions if none exist
    const { data: existingSlos } = await supabase.from("slo_definitions").select("id").eq("user_id", userId).limit(1);
    if (!existingSlos?.length) {
      const { data: allSvcs } = await supabase.from("services").select("id, name, type").eq("user_id", userId);
      if (allSvcs?.length) {
        const sloInserts = allSvcs.slice(0, 4).map((svc: any) => ({
          user_id: userId,
          service_id: svc.id,
          name: `${svc.name} ${svc.type === "database" ? "Latency" : "Uptime"} SLO`,
          slo_type: svc.type === "database" || svc.type === "cache" ? "latency" : "uptime",
          target_percentage: svc.type === "database" ? 99.5 : 99.9,
          latency_threshold_ms: svc.type === "database" ? 50 : svc.type === "cache" ? 10 : null,
          window_days: 30,
        }));
        await supabase.from("slo_definitions").insert(sloInserts);
      }
    }

    return new Response(JSON.stringify({ success: true, metricsGenerated: metrics.length, logsGenerated: logEntriesRaw.length, spikeScenario: isSpike }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-telemetry error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
