import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap, Clock, CheckCircle, Loader2, Play, Pause, SkipForward, SkipBack, History, Shield, BookOpen, BrainCircuit } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow, format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Incident {
  id: string;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  ai_analysis: any;
  started_at: string;
  resolved_at: string | null;
}

interface IncidentEvent {
  id: string;
  event_type: string;
  title: string;
  description: string | null;
  severity: string;
  occurred_at: string;
}

const severityColor: Record<string, string> = {
  info: "bg-chart-2/15 text-chart-2 border-chart-2/30",
  warning: "bg-warning/15 text-warning border-warning/30",
  critical: "bg-destructive/15 text-destructive border-destructive/30",
};

const eventTypeIcon: Record<string, string> = {
  metric_spike: "📈",
  log_error: "📝",
  alert_triggered: "🔔",
  service_degraded: "⚠️",
  status_change: "🔄",
  ai_analysis: "🤖",
  resolution: "✅",
};

const statusIcon: Record<string, any> = {
  active: Zap,
  investigating: Clock,
  resolved: CheckCircle,
};

export default function Incidents() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [replayIncident, setReplayIncident] = useState<Incident | null>(null);
  const [events, setEvents] = useState<IncidentEvent[]>([]);
  const [replayIndex, setReplayIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [liveEvents, setLiveEvents] = useState<IncidentEvent[]>([]);
  const [liveIncidentId, setLiveIncidentId] = useState<string | null>(null);
  const [escalationPolicies, setEscalationPolicies] = useState<{ id: string; name: string }[]>([]);
  const [escalating, setEscalating] = useState<string | null>(null);
  const [selectedPolicy, setSelectedPolicy] = useState<string>("");

  const fetchIncidents = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("incidents")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (data) setIncidents(data as Incident[]);
  };

  useEffect(() => {
    fetchIncidents();
    if (user) {
      supabase.from("escalation_policies").select("id, name").eq("user_id", user.id).then(({ data }) => {
        if (data) setEscalationPolicies(data);
      });
    }
  }, [user]);

  // Realtime subscriptions for incidents and events
  useEffect(() => {
    if (!user) return;

    const incidentChannel = supabase
      .channel("incidents-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "incidents" }, (payload) => {
        if (payload.eventType === "INSERT") {
          const newIncident = payload.new as Incident;
          setIncidents((prev) => [newIncident, ...prev]);
          toast({ title: "🔴 New incident", description: newIncident.title });
        } else if (payload.eventType === "UPDATE") {
          setIncidents((prev) => prev.map((inc) => inc.id === (payload.new as Incident).id ? (payload.new as Incident) : inc));
        }
      })
      .subscribe();

    const eventsChannel = supabase
      .channel("incident-events-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "incident_events" }, (payload) => {
        const newEvent = payload.new as IncidentEvent;
        // Update live timeline if viewing this incident
        setLiveEvents((prev) => {
          if (prev.length > 0 && prev[0] && (payload.new as any).incident_id === liveIncidentId) {
            return [...prev, newEvent];
          }
          return prev;
        });
        // Also update the replay dialog events if open
        if (replayIncident && (payload.new as any).incident_id === replayIncident.id) {
          setEvents((prev) => [...prev, newEvent]);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(incidentChannel);
      supabase.removeChannel(eventsChannel);
    };
  }, [user, liveIncidentId, replayIncident?.id]);

  const explainIncident = async (incident: Incident) => {
    setAnalyzing(incident.id);
    try {
      const { data, error } = await supabase.functions.invoke("explain-incident", {
        body: { incidentId: incident.id },
      });
      if (error) throw error;
      if (user) {
        await (supabase as any).from("audit_log").insert({
          user_id: user.id, action: "incident_ai_analysis", resource_type: "incident",
          resource_id: incident.id, details: { title: incident.title, severity: incident.severity },
        });
      }
      fetchIncidents();
      toast({ title: "AI analysis complete" });
    } catch (err: any) {
      toast({ title: "Analysis failed", description: err.message, variant: "destructive" });
    } finally {
      setAnalyzing(null);
    }
  };

  const openReplay = async (incident: Incident) => {
    setReplayIncident(incident);
    setReplayIndex(0);
    setPlaying(false);
    const { data } = await supabase
      .from("incident_events")
      .select("*")
      .eq("incident_id", incident.id)
      .order("occurred_at", { ascending: true });
    setEvents((data as IncidentEvent[]) ?? []);
  };

  // Auto-play
  useEffect(() => {
    if (!playing || replayIndex >= events.length - 1) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => setReplayIndex((i) => i + 1), 2000);
    return () => clearTimeout(timer);
  }, [playing, replayIndex, events.length]);

  const openLiveTimeline = async (incident: Incident) => {
    setLiveIncidentId(incident.id);
    const { data } = await supabase
      .from("incident_events")
      .select("*")
      .eq("incident_id", incident.id)
      .order("occurred_at", { ascending: true });
    setLiveEvents((data as IncidentEvent[]) ?? []);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Incidents</h1>
        <p className="text-sm text-muted-foreground">AI-powered analysis with real-time timeline</p>
      </div>

      {/* Live Timeline Panel */}
      {liveIncidentId && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              Live Timeline
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setLiveIncidentId(null)}>Close</Button>
          </CardHeader>
          <CardContent>
            <div className="relative pl-6 space-y-2 max-h-64 overflow-y-auto">
              <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-border" />
              <AnimatePresence>
                {liveEvents.map((event) => (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="relative rounded-lg border border-border/50 p-2"
                  >
                    <div className="absolute -left-[18px] top-3 h-2.5 w-2.5 rounded-full border-2 border-primary bg-primary/50" />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span>{eventTypeIcon[event.event_type] ?? "📌"}</span>
                        <p className="text-xs font-medium">{event.title}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`text-[10px] ${severityColor[event.severity]}`}>{event.severity}</Badge>
                        <span className="text-[10px] text-muted-foreground font-mono">{format(new Date(event.occurred_at), "HH:mm:ss")}</span>
                      </div>
                    </div>
                    {event.description && <p className="text-xs text-muted-foreground mt-1 ml-6">{event.description}</p>}
                  </motion.div>
                ))}
              </AnimatePresence>
              {liveEvents.length === 0 && <p className="text-xs text-muted-foreground py-4 text-center">No events yet. New events will appear in real-time.</p>}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {incidents.map((incident, i) => {
          const StatusIcon = statusIcon[incident.status] || Zap;
          return (
            <motion.div key={incident.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="border-border/50">
                <CardHeader className="flex flex-row items-start justify-between pb-3">
                  <div className="flex items-center gap-3">
                    <StatusIcon className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <CardTitle className="text-base">{incident.title}</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(incident.started_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={severityColor[incident.severity]}>{incident.severity}</Badge>
                    <Badge variant="outline" className="capitalize">{incident.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {incident.description && <p className="text-sm text-muted-foreground">{incident.description}</p>}

                  {incident.ai_analysis ? (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-primary flex items-center gap-2">
                          <BrainCircuit className="h-4 w-4" /> AI Analysis
                        </h4>
                        {incident.ai_analysis.confidence != null && (
                          <Badge variant="outline" className={
                            incident.ai_analysis.confidence >= 80 ? "bg-success/15 text-success border-success/30" :
                            incident.ai_analysis.confidence >= 50 ? "bg-warning/15 text-warning border-warning/30" :
                            "bg-destructive/15 text-destructive border-destructive/30"
                          }>
                            Confidence: {incident.ai_analysis.confidence}%
                          </Badge>
                        )}
                      </div>
                      {incident.ai_analysis.summary && (
                        <div><p className="text-xs font-medium text-muted-foreground">What happened</p><p className="text-sm">{incident.ai_analysis.summary}</p></div>
                      )}
                      {incident.ai_analysis.root_cause && (
                        <div><p className="text-xs font-medium text-muted-foreground">Root cause</p><p className="text-sm">{incident.ai_analysis.root_cause}</p></div>
                      )}
                      {incident.ai_analysis.evidence?.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Evidence</p>
                          <ul className="mt-1 space-y-1">
                            {incident.ai_analysis.evidence.slice(0, 3).map((e: string, j: number) => (
                              <li key={j} className="flex items-center gap-2 text-sm"><CheckCircle className="h-3 w-3 text-success shrink-0" />{e}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <Link to={`/incidents/${incident.id}/story`}>
                        <Button variant="outline" size="sm" className="w-full mt-2">
                          <BookOpen className="mr-2 h-4 w-4" /> View Full Story & Analysis
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <Button
                      variant="outline" size="sm"
                      onClick={() => explainIncident(incident)}
                      disabled={analyzing === incident.id}
                    >
                      {analyzing === incident.id ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analyzing...</>
                      ) : (
                        <><Zap className="mr-2 h-4 w-4" />Explain Issue</>
                      )}
                    </Button>
                  )}

                  <div className="flex items-center gap-2 flex-wrap">
                   <Link to={`/incidents/${incident.id}/story`}>
                     <Button variant="default" size="sm">
                       <BookOpen className="mr-2 h-4 w-4" />Incident Story
                     </Button>
                   </Link>
                   <Button variant="outline" size="sm" onClick={() => openReplay(incident)}>
                     <History className="mr-2 h-4 w-4" />Timeline Replay
                   </Button>
                   <Button variant="outline" size="sm" onClick={() => openLiveTimeline(incident)}>
                     <span className="relative flex h-2 w-2 mr-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-chart-2 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-chart-2" /></span>
                     Live
                   </Button>
                  </div>
                   {incident.status !== "resolved" && escalationPolicies.length > 0 && (
                     <div className="flex items-center gap-2">
                       <Select value={selectedPolicy} onValueChange={setSelectedPolicy}>
                         <SelectTrigger className="h-9 w-[180px] text-xs">
                           <SelectValue placeholder="Escalation policy..." />
                         </SelectTrigger>
                         <SelectContent>
                           {escalationPolicies.map((p) => (
                             <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                           ))}
                         </SelectContent>
                       </Select>
                       <Button
                         variant="destructive"
                         size="sm"
                         disabled={!selectedPolicy || escalating === incident.id}
                         onClick={async () => {
                           if (!user || !selectedPolicy) return;
                           setEscalating(incident.id);
                           try {
                              const { error } = await supabase.functions.invoke("escalation-notify", {
                                body: {
                                  incident_id: incident.id,
                                  incident_title: incident.title,
                                  severity: incident.severity,
                                  user_id: user.id,
                                  policy_id: selectedPolicy,
                                },
                              });
                              if (error) throw error;
                              await (supabase as any).from("audit_log").insert({
                                user_id: user.id, action: "incident_escalated", resource_type: "incident",
                                resource_id: incident.id, details: { title: incident.title, severity: incident.severity, policy_id: selectedPolicy },
                              });
                              toast({ title: "Escalation triggered", description: "Notifications sent per policy levels." });
                           } catch (err: any) {
                             toast({ title: "Escalation failed", description: err.message, variant: "destructive" });
                           } finally {
                             setEscalating(null);
                           }
                         }}
                       >
                         {escalating === incident.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Shield className="mr-1 h-3 w-3" />}
                         Escalate
                       </Button>
                     </div>
                   )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {incidents.length === 0 && (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center py-12 text-center">
            <Zap className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="text-lg font-semibold">No incidents</h3>
            <p className="mt-1 text-sm text-muted-foreground">All systems running smoothly. Generate demo data to see incidents.</p>
          </CardContent>
        </Card>
      )}

      {/* Timeline Replay Dialog */}
      <Dialog open={!!replayIncident} onOpenChange={() => setReplayIncident(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Incident Timeline: {replayIncident?.title}
            </DialogTitle>
          </DialogHeader>

          {events.length > 0 ? (
            <div className="space-y-4">
              {/* Playback controls */}
              <div className="flex items-center justify-center gap-3 border rounded-lg p-3 bg-secondary/30">
                <Button variant="ghost" size="icon" onClick={() => setReplayIndex(Math.max(0, replayIndex - 1))} disabled={replayIndex === 0}>
                  <SkipBack className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setPlaying(!playing)}>
                  {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setReplayIndex(Math.min(events.length - 1, replayIndex + 1))} disabled={replayIndex >= events.length - 1}>
                  <SkipForward className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground font-mono ml-2">
                  {replayIndex + 1} / {events.length}
                </span>
              </div>

              {/* Timeline */}
              <div className="relative pl-8 space-y-1">
                <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-border" />
                {events.map((event, i) => {
                  const isActive = i <= replayIndex;
                  const isCurrent = i === replayIndex;
                  return (
                    <AnimatePresence key={event.id}>
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: isActive ? 1 : 0.3, x: 0 }}
                        transition={{ duration: 0.3 }}
                        className={`relative rounded-lg border p-3 cursor-pointer transition-all ${isCurrent ? "border-primary bg-primary/5 shadow-sm" : "border-border/50"}`}
                        onClick={() => setReplayIndex(i)}
                      >
                        {/* Timeline dot */}
                        <div className={`absolute -left-[22px] top-4 h-3 w-3 rounded-full border-2 ${isCurrent ? "border-primary bg-primary" : isActive ? "border-primary/50 bg-primary/30" : "border-border bg-background"}`} />

                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-base">{eventTypeIcon[event.event_type] ?? "📌"}</span>
                            <div>
                              <p className={`text-sm font-medium ${isCurrent ? "text-foreground" : "text-muted-foreground"}`}>{event.title}</p>
                              {event.description && isActive && (
                                <motion.p
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  className="text-xs text-muted-foreground mt-1"
                                >
                                  {event.description}
                                </motion.p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={`text-[10px] ${severityColor[event.severity]}`}>{event.severity}</Badge>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {format(new Date(event.occurred_at), "HH:mm:ss")}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    </AnimatePresence>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground text-sm">
              No timeline events recorded for this incident.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
