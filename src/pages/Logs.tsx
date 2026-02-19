import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { FileText, Search, Link2 } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

interface LogEntry {
  id: string;
  severity: string;
  message: string;
  source: string | null;
  timestamp: string;
  trace_id: string | null;
  span_id: string | null;
}

const severityStyles: Record<string, string> = {
  info: "bg-chart-2/15 text-chart-2",
  warn: "bg-warning/15 text-warning",
  error: "bg-destructive/15 text-destructive",
  critical: "bg-destructive/20 text-destructive font-semibold",
};

export default function Logs() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState("all");
  const [correlationFilter, setCorrelationFilter] = useState("all"); // all, correlated, uncorrelated

  useEffect(() => {
    if (!user) return;
    const fetchLogs = async () => {
      let query = supabase
        .from("logs")
        .select("id, severity, message, source, timestamp, trace_id, span_id, server_id, servers!inner(user_id)")
        .order("timestamp", { ascending: false })
        .limit(200);

      if (severity !== "all") query = query.eq("severity", severity);

      const { data } = await query;
      if (data) setLogs(data as unknown as LogEntry[]);
    };
    fetchLogs();

    const channel = supabase
      .channel("logs-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "logs" }, () => fetchLogs())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, severity]);

  const filtered = logs
    .filter((l) => l.message.toLowerCase().includes(search.toLowerCase()))
    .filter((l) => {
      if (correlationFilter === "correlated") return !!l.trace_id;
      if (correlationFilter === "uncorrelated") return !l.trace_id;
      return true;
    });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Logs</h1>
        <p className="text-sm text-muted-foreground">Real-time log stream with filtering</p>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search logs..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={severity} onValueChange={setSeverity}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warn">Warning</SelectItem>
            <SelectItem value="error">Error</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>
        <Select value={correlationFilter} onValueChange={setCorrelationFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Logs</SelectItem>
            <SelectItem value="correlated">With Trace</SelectItem>
            <SelectItem value="uncorrelated">No Trace</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="border-border/50 overflow-hidden">
        <CardContent className="p-0">
          <div className="divide-y divide-border max-h-[70vh] overflow-auto">
            {filtered.map((log) => (
              <div key={log.id} className="flex items-start gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors">
                <Badge variant="outline" className={`mt-0.5 shrink-0 text-xs ${severityStyles[log.severity] ?? ""}`}>
                  {log.severity}
                </Badge>
                <p className="flex-1 text-sm font-mono leading-relaxed">{log.message}</p>
                {log.trace_id && (
                  <button
                    onClick={() => navigate("/traces")}
                    className="flex items-center gap-1 shrink-0 text-[10px] font-mono text-primary hover:underline"
                    title={`Trace: ${log.trace_id}\nSpan: ${log.span_id}`}
                  >
                    <Link2 className="h-3 w-3" />
                    {log.trace_id.slice(0, 8)}…
                  </button>
                )}
                <span className="shrink-0 text-xs text-muted-foreground font-mono">
                  {format(new Date(log.timestamp), "HH:mm:ss")}
                </span>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="flex flex-col items-center py-12 text-center">
                <FileText className="mb-4 h-10 w-10 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">No logs found</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
