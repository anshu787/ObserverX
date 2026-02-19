import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Search, Activity, Clock, AlertTriangle, ChevronRight, FileText } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";

interface Trace {
  id: string;
  trace_id: string;
  span_id: string;
  parent_span_id: string | null;
  operation_name: string;
  service_id: string;
  duration_ms: number;
  status: string;
  started_at: string;
  metadata: any;
}

interface Service {
  id: string;
  name: string;
  type: string;
}

const statusColors: Record<string, string> = {
  ok: "bg-chart-2/15 text-chart-2 border-chart-2/30",
  error: "bg-destructive/15 text-destructive border-destructive/30",
  timeout: "bg-warning/15 text-warning border-warning/30",
};

const barColors: Record<string, string> = {
  ok: "bg-chart-2",
  error: "bg-destructive",
  timeout: "bg-warning",
};

export default function Traces() {
  const { user } = useAuth();
  const [traces, setTraces] = useState<Trace[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedTrace, setSelectedTrace] = useState<string | null>(null);
  const [traceSpans, setTraceSpans] = useState<Trace[]>([]);
  const [correlatedLogs, setCorrelatedLogs] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const [tRes, sRes] = await Promise.all([
        supabase.from("traces").select("*").order("started_at", { ascending: false }).limit(100),
        supabase.from("services").select("id, name, type").eq("user_id", user.id),
      ]);
      if (tRes.data) setTraces(tRes.data as Trace[]);
      if (sRes.data) setServices(sRes.data as Service[]);
    };
    fetchData();
  }, [user]);

  const serviceName = (id: string) => services.find((s) => s.id === id)?.name || "Unknown";

  // Group traces by trace_id (root spans only)
  const traceGroups = traces.reduce<Record<string, Trace[]>>((acc, t) => {
    if (!acc[t.trace_id]) acc[t.trace_id] = [];
    acc[t.trace_id].push(t);
    return acc;
  }, {});

  const rootSpans = Object.entries(traceGroups)
    .map(([traceId, spans]) => {
      const root = spans.find((s) => !s.parent_span_id) || spans[0];
      const totalDuration = spans.reduce((max, s) => Math.max(max, s.duration_ms), 0);
      const hasError = spans.some((s) => s.status === "error");
      const spanCount = spans.length;
      const serviceIds = [...new Set(spans.map((s) => s.service_id))];
      return { traceId, root, totalDuration, hasError, spanCount, serviceIds, spans };
    })
    .filter((t) => {
      if (search && !t.root.operation_name.toLowerCase().includes(search.toLowerCase()) && !t.traceId.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter !== "all" && (statusFilter === "error" ? !t.hasError : t.hasError)) return false;
      if (serviceFilter !== "all" && !t.serviceIds.includes(serviceFilter)) return false;
      return true;
    })
    .sort((a, b) => new Date(b.root.started_at).getTime() - new Date(a.root.started_at).getTime());

  const openTrace = async (traceId: string) => {
    setSelectedTrace(traceId);
    const spans = traceGroups[traceId] || [];
    setTraceSpans(spans.sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime()));
    // Fetch correlated logs
    const { data: logs } = await supabase.from("logs").select("id, severity, message, source, timestamp, span_id").eq("trace_id", traceId).order("timestamp", { ascending: true });
    setCorrelatedLogs(logs || []);
  };

  // Waterfall calculations
  const waterfallData = () => {
    if (traceSpans.length === 0) return { spans: [], totalMs: 0, startTime: 0 };
    const startTime = Math.min(...traceSpans.map((s) => new Date(s.started_at).getTime()));
    const endTime = Math.max(...traceSpans.map((s) => new Date(s.started_at).getTime() + s.duration_ms));
    const totalMs = endTime - startTime;
    const spans = traceSpans.map((s) => {
      const offset = new Date(s.started_at).getTime() - startTime;
      return { ...s, offsetPct: totalMs > 0 ? (offset / totalMs) * 100 : 0, widthPct: totalMs > 0 ? (s.duration_ms / totalMs) * 100 : 100 };
    });
    return { spans, totalMs, startTime };
  };

  const { spans: waterfall, totalMs } = waterfallData();

  // Service latency breakdown
  const serviceLatency = traceSpans.reduce<Record<string, { total: number; count: number; errors: number }>>((acc, s) => {
    const name = serviceName(s.service_id);
    if (!acc[name]) acc[name] = { total: 0, count: 0, errors: 0 };
    acc[name].total += s.duration_ms;
    acc[name].count += 1;
    if (s.status === "error") acc[name].errors += 1;
    return acc;
  }, {});

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Distributed Traces</h1>
        <p className="text-sm text-muted-foreground">Request flows across services with latency breakdowns</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by operation or trace ID..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="ok">✅ Success</SelectItem>
            <SelectItem value="error">❌ Error</SelectItem>
          </SelectContent>
        </Select>
        <Select value={serviceFilter} onValueChange={setServiceFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Service" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Services</SelectItem>
            {services.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Trace List */}
      <div className="space-y-2">
        {rootSpans.map((trace, i) => (
          <motion.div key={trace.traceId} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
            <Card
              className="border-border/50 cursor-pointer hover:border-primary/30 transition-colors"
              onClick={() => openTrace(trace.traceId)}
            >
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${trace.hasError ? "bg-destructive" : "bg-chart-2"}`} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{trace.root.operation_name}</p>
                      {trace.hasError && <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[120px]">{trace.traceId.slice(0, 12)}…</span>
                      <span className="text-[10px] text-muted-foreground">{trace.spanCount} spans</span>
                      <span className="text-[10px] text-muted-foreground">{trace.serviceIds.length} services</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="text-sm font-mono font-medium">{trace.totalDuration.toFixed(1)}ms</p>
                    <p className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(trace.root.started_at), { addSuffix: true })}</p>
                  </div>
                  {/* Mini latency bar */}
                  <div className="w-20 h-2 rounded-full bg-secondary overflow-hidden">
                    {trace.spans.slice(0, 4).map((s, j) => {
                      const pct = trace.totalDuration > 0 ? (s.duration_ms / trace.totalDuration) * 100 : 25;
                      return <div key={j} className={`h-full inline-block ${barColors[s.status] || "bg-muted"}`} style={{ width: `${Math.max(pct, 5)}%` }} />;
                    })}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}

        {rootSpans.length === 0 && (
          <Card className="border-dashed border-2">
            <CardContent className="flex flex-col items-center py-12 text-center">
              <Activity className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <h3 className="text-lg font-semibold">No traces found</h3>
              <p className="mt-1 text-sm text-muted-foreground">Generate demo data to see distributed traces, or adjust your filters.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Trace Detail Sheet */}
      <Sheet open={!!selectedTrace} onOpenChange={() => setSelectedTrace(null)}>
        <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
          {selectedTrace && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Trace Detail
                </SheetTitle>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Summary */}
                <div className="grid grid-cols-3 gap-3">
                  <Card className="border-border/50">
                    <CardContent className="p-3 text-center">
                      <p className="text-xs text-muted-foreground">Total Duration</p>
                      <p className="text-lg font-mono font-bold">{totalMs.toFixed(1)}ms</p>
                    </CardContent>
                  </Card>
                  <Card className="border-border/50">
                    <CardContent className="p-3 text-center">
                      <p className="text-xs text-muted-foreground">Spans</p>
                      <p className="text-lg font-bold">{traceSpans.length}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-border/50">
                    <CardContent className="p-3 text-center">
                      <p className="text-xs text-muted-foreground">Errors</p>
                      <p className={`text-lg font-bold ${traceSpans.some((s) => s.status === "error") ? "text-destructive" : "text-chart-2"}`}>
                        {traceSpans.filter((s) => s.status === "error").length}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Critical Path Detection */}
                {traceSpans.length > 0 && (() => {
                  const criticalSpan = traceSpans.reduce((max, s) => s.duration_ms > max.duration_ms ? s : max, traceSpans[0]);
                  const criticalPct = totalMs > 0 ? ((criticalSpan.duration_ms / totalMs) * 100).toFixed(0) : "0";
                  return (
                    <Card className="border-warning/30 bg-warning/5">
                      <CardContent className="p-3 flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning/20 shrink-0">
                          <Clock className="h-4 w-4 text-warning" />
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">⚡ Critical Path</p>
                          <p className="text-sm font-semibold">
                            {criticalSpan.operation_name} <span className="text-warning">({criticalPct}% of latency)</span>
                          </p>
                          <p className="text-[10px] text-muted-foreground">{serviceName(criticalSpan.service_id)} • {criticalSpan.duration_ms.toFixed(1)}ms</p>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })()}

                {/* Latency Breakdown Panel */}
                <div>
                  <p className="text-sm font-medium mb-2">Latency Breakdown</p>
                  <Card className="border-border/50">
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Total Request</span>
                        <span className="font-mono font-bold text-foreground">{totalMs.toFixed(0)}ms</span>
                      </div>
                      <div className="w-full h-3 rounded-full bg-secondary overflow-hidden flex">
                        {Object.entries(serviceLatency)
                          .sort(([, a], [, b]) => b.total - a.total)
                          .map(([name, data], i) => {
                            const pct = totalMs > 0 ? (data.total / totalMs) * 100 : 0;
                            const colors = ["bg-primary", "bg-chart-2", "bg-warning", "bg-destructive", "bg-accent"];
                            return (
                              <motion.div
                                key={name}
                                className={`h-full ${colors[i % colors.length]}`}
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.5, delay: i * 0.1 }}
                                title={`${name}: ${data.total.toFixed(0)}ms`}
                              />
                            );
                          })}
                      </div>
                      <div className="space-y-1.5 pt-1">
                        {Object.entries(serviceLatency)
                          .sort(([, a], [, b]) => b.total - a.total)
                          .map(([name, data], i) => {
                            const pct = totalMs > 0 ? (data.total / totalMs) * 100 : 0;
                            const colors = ["text-primary", "text-chart-2", "text-warning", "text-destructive", "text-accent"];
                            const dotColors = ["bg-primary", "bg-chart-2", "bg-warning", "bg-destructive", "bg-accent"];
                            return (
                              <div key={name} className="flex items-center justify-between text-[11px]">
                                <div className="flex items-center gap-1.5">
                                  <div className={`h-2 w-2 rounded-full ${dotColors[i % dotColors.length]}`} />
                                  <span>{name}</span>
                                </div>
                                <span className={`font-mono font-medium ${colors[i % colors.length]}`}>
                                  {data.total.toFixed(0)}ms ({pct.toFixed(0)}%)
                                </span>
                              </div>
                            );
                          })}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Service Latency Breakdown (bar view) */}
                <div>
                  <p className="text-sm font-medium mb-3">Service Latency Breakdown</p>
                  <div className="space-y-2">
                    {Object.entries(serviceLatency)
                      .sort(([, a], [, b]) => b.total - a.total)
                      .map(([name, data]) => {
                        const pct = totalMs > 0 ? (data.total / totalMs) * 100 : 0;
                        return (
                          <div key={name} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{name}</span>
                                {data.errors > 0 && <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30">{data.errors} err</Badge>}
                              </div>
                              <span className="font-mono text-muted-foreground">{data.total.toFixed(1)}ms ({pct.toFixed(0)}%)</span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
                              <motion.div
                                className={`h-full rounded-full ${data.errors > 0 ? "bg-destructive" : "bg-primary"}`}
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.5, delay: 0.1 }}
                              />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Waterfall View */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium">Waterfall Timeline</p>
                    <span className="text-xs text-muted-foreground font-mono">{totalMs.toFixed(1)}ms total</span>
                  </div>

                  {/* Time axis */}
                  <div className="flex items-center justify-between mb-1 pl-[140px]">
                    <span className="text-[10px] text-muted-foreground font-mono">0ms</span>
                    <span className="text-[10px] text-muted-foreground font-mono">{(totalMs / 2).toFixed(0)}ms</span>
                    <span className="text-[10px] text-muted-foreground font-mono">{totalMs.toFixed(0)}ms</span>
                  </div>

                  <div className="space-y-1">
                    {waterfall.map((span, i) => {
                      const depth = span.parent_span_id ? 1 : 0;
                      return (
                        <motion.div
                          key={span.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className="flex items-center gap-2 group"
                        >
                          {/* Service + operation label */}
                          <div className="w-[140px] shrink-0 text-right pr-2" style={{ paddingLeft: depth * 12 }}>
                            <p className="text-[10px] text-muted-foreground truncate">{serviceName(span.service_id)}</p>
                            <p className="text-[11px] font-medium truncate">{span.operation_name}</p>
                          </div>

                          {/* Bar */}
                          <div className="flex-1 relative h-6 rounded bg-secondary/30">
                            <motion.div
                              className={`absolute top-0.5 bottom-0.5 rounded ${barColors[span.status] || "bg-muted"}`}
                              style={{ left: `${span.offsetPct}%`, width: `${Math.max(span.widthPct, 0.5)}%` }}
                              initial={{ scaleX: 0 }}
                              animate={{ scaleX: 1 }}
                              transition={{ duration: 0.3, delay: i * 0.05 }}
                            />
                            {/* Duration label */}
                            <span
                              className="absolute top-0.5 text-[10px] font-mono text-foreground/80 leading-5 px-1"
                              style={{ left: `${span.offsetPct + span.widthPct + 1}%` }}
                            >
                              {span.duration_ms.toFixed(1)}ms
                            </span>
                          </div>

                          {/* Status */}
                          <Badge variant="outline" className={`text-[9px] shrink-0 ${statusColors[span.status] || ""}`}>
                            {span.status}
                          </Badge>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>

                {/* Correlated Logs */}
                {correlatedLogs.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-medium">Correlated Logs ({correlatedLogs.length})</p>
                    </div>
                    <div className="space-y-1 max-h-[200px] overflow-y-auto rounded-lg border border-border/50">
                      {correlatedLogs.map((log: any) => (
                        <div key={log.id} className="flex items-start gap-2 px-3 py-2 text-xs hover:bg-secondary/50">
                          <Badge variant="outline" className={`shrink-0 text-[9px] ${log.severity === "error" || log.severity === "critical" ? "text-destructive border-destructive/30" : log.severity === "warn" ? "text-warning border-warning/30" : "text-chart-2 border-chart-2/30"}`}>
                            {log.severity}
                          </Badge>
                          <span className="font-mono flex-1 truncate">{log.message}</span>
                          <span className="text-muted-foreground font-mono shrink-0">{log.span_id?.slice(0, 8)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Trace Sampling Config (Design Decision) */}
                <Card className="border-border/50">
                  <CardContent className="p-3">
                    <p className="text-xs font-medium mb-2">📐 Trace Sampling Strategy</p>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] rounded-md bg-destructive/5 px-2 py-1.5">
                        <span className="text-muted-foreground">Errors</span>
                        <span className="font-mono font-bold text-destructive">100%</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] rounded-md bg-warning/5 px-2 py-1.5">
                        <span className="text-muted-foreground">Slow (&gt;500ms)</span>
                        <span className="font-mono font-bold text-warning">100%</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] rounded-md bg-secondary px-2 py-1.5">
                        <span className="text-muted-foreground">Success</span>
                        <span className="font-mono font-bold text-chart-2">10%</span>
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-2 italic">Head-based sampling — always captures errors and slow requests</p>
                  </CardContent>
                </Card>

                {/* Trace ID */}
                <div className="rounded-lg bg-secondary/30 p-3">
                  <p className="text-xs text-muted-foreground">Trace ID</p>
                  <p className="text-xs font-mono break-all">{selectedTrace}</p>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
