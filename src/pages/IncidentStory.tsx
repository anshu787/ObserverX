import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Zap, Loader2, Clock, CheckCircle, AlertTriangle, 
  TrendingUp, Activity, Shield, Cpu, GitCommit, RefreshCw,
  ChevronRight, Gauge, BarChart3, BrainCircuit, Wrench
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow, differenceInMinutes } from "date-fns";

interface Incident {
  id: string;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  ai_analysis: any;
  started_at: string;
  resolved_at: string | null;
  affected_services: string[] | null;
}

interface IncidentEvent {
  id: string;
  event_type: string;
  title: string;
  description: string | null;
  severity: string;
  occurred_at: string;
  metadata: any;
}

const eventIcons: Record<string, { icon: typeof Zap; color: string }> = {
  deployment: { icon: GitCommit, color: "text-chart-2" },
  metric_spike: { icon: TrendingUp, color: "text-warning" },
  log_error: { icon: AlertTriangle, color: "text-destructive" },
  alert_triggered: { icon: Zap, color: "text-destructive" },
  service_degraded: { icon: Activity, color: "text-warning" },
  status_change: { icon: RefreshCw, color: "text-chart-2" },
  ai_analysis: { icon: BrainCircuit, color: "text-primary" },
  resolution: { icon: CheckCircle, color: "text-success" },
  config_change: { icon: Wrench, color: "text-chart-2" },
  traffic_spike: { icon: BarChart3, color: "text-warning" },
};

const severityColor: Record<string, string> = {
  info: "border-chart-2/40 bg-chart-2/10",
  warning: "border-warning/40 bg-warning/10",
  critical: "border-destructive/40 bg-destructive/10",
};

export default function IncidentStory() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [events, setEvents] = useState<IncidentEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    if (!user || !id) return;
    const fetchData = async () => {
      const [incRes, evRes] = await Promise.all([
        supabase.from("incidents").select("*").eq("id", id).eq("user_id", user.id).maybeSingle(),
        supabase.from("incident_events").select("*").eq("incident_id", id).order("occurred_at", { ascending: true }),
      ]);
      if (incRes.data) setIncident(incRes.data as Incident);
      if (evRes.data) setEvents(evRes.data as IncidentEvent[]);
      setLoading(false);
    };
    fetchData();

    // Realtime for new events
    const channel = supabase
      .channel(`story-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "incident_events", filter: `incident_id=eq.${id}` }, (payload) => {
        setEvents((prev) => [...prev, payload.new as IncidentEvent]);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "incidents", filter: `id=eq.${id}` }, (payload) => {
        setIncident(payload.new as Incident);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, id]);

  const explainIncident = async () => {
    if (!incident) return;
    setAnalyzing(true);
    try {
      const { error } = await supabase.functions.invoke("explain-incident", {
        body: { incidentId: incident.id },
      });
      if (error) throw error;
      // Refetch incident for updated ai_analysis
      const { data } = await supabase.from("incidents").select("*").eq("id", incident.id).maybeSingle();
      if (data) setIncident(data as Incident);
      toast({ title: "AI analysis complete" });
    } catch (err: any) {
      toast({ title: "Analysis failed", description: err.message, variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  };

  const analysis = incident?.ai_analysis;
  const duration = incident
    ? differenceInMinutes(incident.resolved_at ? new Date(incident.resolved_at) : new Date(), new Date(incident.started_at))
    : 0;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Incident not found.</p>
        <Link to="/incidents"><Button variant="outline" className="mt-4"><ArrowLeft className="mr-2 h-4 w-4" />Back</Button></Link>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link to="/incidents" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2">
            <ArrowLeft className="h-3 w-3" /> Back to Incidents
          </Link>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            <div className={`h-3 w-3 rounded-full ${incident.status === "resolved" ? "bg-success" : "bg-destructive animate-pulse"}`} />
            {incident.title}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Started {format(new Date(incident.started_at), "MMM d, yyyy HH:mm:ss")} · Duration: {duration} min
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={severityColor[incident.severity]}>{incident.severity}</Badge>
          <Badge variant="outline" className="capitalize">{incident.status}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT: Timeline */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                System Narrative
              </CardTitle>
            </CardHeader>
            <CardContent>
              {events.length > 0 ? (
                <div className="relative pl-8 space-y-1">
                  <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-gradient-to-b from-primary via-warning to-destructive opacity-30" />
                  {events.map((event, i) => {
                    const config = eventIcons[event.event_type] || { icon: Activity, color: "text-muted-foreground" };
                    const Icon = config.icon;
                    return (
                      <motion.div
                        key={event.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.08 }}
                        className={`relative rounded-lg border p-3 ${severityColor[event.severity] || "border-border/50"}`}
                      >
                        <div className={`absolute -left-[22px] top-4 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background bg-card shadow-sm`}>
                          <Icon className={`h-3 w-3 ${config.color}`} />
                        </div>
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-medium">{event.title}</p>
                            {event.description && (
                              <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground font-mono shrink-0 ml-4">
                            {format(new Date(event.occurred_at), "HH:mm:ss")}
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No timeline events recorded yet. Events auto-populate as the incident progresses.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: AI Intelligence Panel */}
        <div className="space-y-4">
          {/* AI Analysis + Confidence */}
          {analysis ? (
            <>
              <Card className="border-primary/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BrainCircuit className="h-4 w-4 text-primary" />
                    AI Root Cause Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Confidence Score */}
                  {analysis.confidence != null && (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-muted-foreground">Root Cause Confidence</span>
                        <span className={`text-lg font-bold font-mono ${analysis.confidence >= 80 ? "text-success" : analysis.confidence >= 50 ? "text-warning" : "text-destructive"}`}>
                          {analysis.confidence}%
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                        <motion.div
                          className={`h-full rounded-full ${analysis.confidence >= 80 ? "bg-success" : analysis.confidence >= 50 ? "bg-warning" : "bg-destructive"}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${analysis.confidence}%` }}
                          transition={{ duration: 1, ease: "easeOut" }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Summary */}
                  {analysis.summary && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">What happened</p>
                      <p className="text-sm">{analysis.summary}</p>
                    </div>
                  )}
                  {analysis.root_cause && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Root cause</p>
                      <p className="text-sm">{analysis.root_cause}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Evidence Panel */}
              {analysis.evidence?.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Shield className="h-4 w-4 text-chart-2" />
                      Evidence
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {analysis.evidence.map((e: any, i: number) => (
                        <motion.li
                          key={i}
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.1 }}
                          className="flex items-start gap-2 text-sm"
                        >
                          <CheckCircle className="h-4 w-4 text-success shrink-0 mt-0.5" />
                          <span>{typeof e === "string" ? e : e.description || e.detail}</span>
                        </motion.li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Suggested Fix Actions */}
              {analysis.fix_steps?.length > 0 && (
                <Card className="border-chart-2/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-chart-2" />
                      Suggested Actions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {analysis.fix_steps.map((step: string, i: number) => (
                        <motion.li
                          key={i}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.3 + i * 0.1 }}
                          className="flex items-start gap-2"
                        >
                          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-chart-2/15 text-chart-2 text-[10px] font-bold mt-0.5">
                            {i + 1}
                          </div>
                          <p className="text-sm">{step}</p>
                        </motion.li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* What Changed? */}
              {analysis.changes_detected?.length > 0 && (
                <Card className="border-warning/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <GitCommit className="h-4 w-4 text-warning" />
                      What Changed?
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {analysis.changes_detected.map((change: string, i: number) => (
                        <li key={i} className="flex items-center gap-2 text-sm">
                          <ChevronRight className="h-3 w-3 text-warning shrink-0" />
                          {change}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Failure Risk */}
              {analysis.failure_risk != null && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Gauge className="h-4 w-4 text-destructive" />
                      Predictive Risk
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Failure Risk</span>
                      <Badge variant="outline" className={
                        analysis.failure_risk >= 70
                          ? "bg-destructive/15 text-destructive border-destructive/30"
                          : analysis.failure_risk >= 40
                          ? "bg-warning/15 text-warning border-warning/30"
                          : "bg-success/15 text-success border-success/30"
                      }>
                        {analysis.failure_risk >= 70 ? "HIGH" : analysis.failure_risk >= 40 ? "MEDIUM" : "LOW"} ({analysis.failure_risk}%)
                      </Badge>
                    </div>
                    {analysis.estimated_recovery_minutes && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Est. recovery: ~{analysis.estimated_recovery_minutes} min
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card className="border-dashed border-2">
              <CardContent className="flex flex-col items-center py-8 text-center">
                <BrainCircuit className="mb-3 h-10 w-10 text-muted-foreground/50" />
                <h3 className="text-sm font-semibold">No AI analysis yet</h3>
                <p className="text-xs text-muted-foreground mt-1 mb-4">Run AI to get root cause, confidence, evidence, and suggested fixes.</p>
                <Button onClick={explainIncident} disabled={analyzing} size="sm">
                  {analyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
                  {analyzing ? "Analyzing..." : "Run AI Analysis"}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Health Score Formula */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Gauge className="h-4 w-4 text-primary" />
                Health Score Formula
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  { label: "Error Rate", weight: 40, color: "bg-destructive" },
                  { label: "Latency (p99)", weight: 30, color: "bg-warning" },
                  { label: "Resource Usage", weight: 20, color: "bg-chart-2" },
                  { label: "Availability", weight: 10, color: "bg-success" },
                ].map(({ label, weight, color }) => (
                  <div key={label} className="flex items-center gap-3">
                    <div className="w-16 text-right">
                      <span className="text-xs font-mono font-bold">{weight}%</span>
                    </div>
                    <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full ${color}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${weight}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-28">{label}</span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-3 text-center font-mono">
                Score = 100 - (0.4×ErrorRate + 0.3×Latency + 0.2×CPU + 0.1×Downtime)
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
