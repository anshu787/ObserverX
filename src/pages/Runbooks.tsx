import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { BookOpen, Plus, Trash2, Play, Loader2, CheckCircle, XCircle, Clock, Zap, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

interface Runbook {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  trigger_conditions: any;
  steps: any[];
  cooldown_minutes: number;
  last_triggered_at: string | null;
  created_at: string;
}

interface Execution {
  id: string;
  runbook_id: string;
  incident_id: string | null;
  status: string;
  steps_completed: any[];
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
}

const actionOptions = [
  { value: "scale_up", label: "Scale Up", desc: "Add instances to a server" },
  { value: "restart_service", label: "Restart Service", desc: "Restart a degraded service" },
  { value: "notify_team", label: "Notify Team", desc: "Send webhook notification" },
  { value: "update_incident", label: "Update Incident", desc: "Change incident status" },
  { value: "create_log", label: "Create Log", desc: "Add a log entry" },
  { value: "wait", label: "Wait", desc: "Pause between steps" },
];

const presetRunbooks = [
  {
    name: "Auto-Scale on High CPU",
    description: "Automatically scale up servers when CPU anomaly is detected",
    trigger_conditions: { metric: "cpu", severity: "critical" },
    steps: [
      { action: "scale_up", server_name: "prod-web-01", count: 2 },
      { action: "update_incident", new_status: "investigating" },
      { action: "notify_team", message: "Auto-scaling triggered due to high CPU. 2 instances added." },
      { action: "create_log", message: "Runbook auto-scale executed for CPU anomaly" },
    ],
    cooldown_minutes: 30,
  },
  {
    name: "Restart on Service Degradation",
    description: "Restart degraded services and notify the team",
    trigger_conditions: { severity: "critical", metric: "any" },
    steps: [
      { action: "restart_service", service_name: "User API" },
      { action: "wait", seconds: 10 },
      { action: "update_incident", new_status: "investigating" },
      { action: "notify_team", message: "Service auto-restarted due to degradation." },
    ],
    cooldown_minutes: 15,
  },
  {
    name: "Latency Spike Response",
    description: "Handle latency spikes by scaling and notifying",
    trigger_conditions: { metric: "latency", severity: "any" },
    steps: [
      { action: "create_log", message: "Latency spike detected, initiating runbook" },
      { action: "scale_up", server_name: "prod-web-01", count: 1 },
      { action: "notify_team", message: "Latency spike detected. Auto-scaling initiated." },
    ],
    cooldown_minutes: 20,
  },
];

export default function Runbooks() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [runbooks, setRunbooks] = useState<Runbook[]>([]);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedExec, setSelectedExec] = useState<Execution | null>(null);
  const [executing, setExecuting] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({
    name: "", description: "",
    triggerMetric: "any", triggerSeverity: "critical",
    cooldown: "30",
    steps: [{ action: "notify_team", message: "", server_name: "", service_name: "", count: "2", seconds: "5", new_status: "investigating" }],
  });

  useEffect(() => {
    if (!user) return;
    fetchData();

    const channel = supabase
      .channel("runbook-executions-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "runbook_executions" }, () => fetchExecutions())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const fetchData = () => { fetchRunbooks(); fetchExecutions(); };

  const fetchRunbooks = async () => {
    if (!user) return;
    const { data } = await supabase.from("runbooks").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    if (data) setRunbooks(data as unknown as Runbook[]);
  };

  const fetchExecutions = async () => {
    if (!user) return;
    const { data } = await supabase.from("runbook_executions").select("*").eq("user_id", user.id).order("started_at", { ascending: false }).limit(50);
    if (data) setExecutions(data as unknown as Execution[]);
  };

  const createRunbook = async () => {
    if (!user || !form.name) return;
    const { error } = await supabase.from("runbooks").insert({
      user_id: user.id,
      name: form.name,
      description: form.description || null,
      trigger_conditions: { metric: form.triggerMetric, severity: form.triggerSeverity },
      steps: form.steps.map((s) => {
        const step: any = { action: s.action };
        if (s.action === "scale_up") { step.server_name = s.server_name; step.count = parseInt(s.count) || 2; }
        if (s.action === "restart_service") { step.service_name = s.service_name; }
        if (s.action === "notify_team" || s.action === "create_log") { step.message = s.message; }
        if (s.action === "update_incident") { step.new_status = s.new_status; }
        if (s.action === "wait") { step.seconds = parseInt(s.seconds) || 5; }
        return step;
      }),
      cooldown_minutes: parseInt(form.cooldown) || 30,
    } as any);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Runbook created" });
      setDialogOpen(false);
      resetForm();
      fetchRunbooks();
    }
  };

  const usePreset = (preset: typeof presetRunbooks[0]) => {
    setForm({
      name: preset.name,
      description: preset.description,
      triggerMetric: preset.trigger_conditions.metric,
      triggerSeverity: preset.trigger_conditions.severity,
      cooldown: String(preset.cooldown_minutes),
      steps: preset.steps.map((s: any) => ({
        action: s.action,
        message: s.message || "",
        server_name: s.server_name || "",
        service_name: s.service_name || "",
        count: String(s.count || 2),
        seconds: String(s.seconds || 5),
        new_status: s.new_status || "investigating",
      })),
    });
  };

  const resetForm = () => {
    setForm({ name: "", description: "", triggerMetric: "any", triggerSeverity: "critical", cooldown: "30", steps: [{ action: "notify_team", message: "", server_name: "", service_name: "", count: "2", seconds: "5", new_status: "investigating" }] });
  };

  const addStep = () => {
    setForm({ ...form, steps: [...form.steps, { action: "notify_team", message: "", server_name: "", service_name: "", count: "2", seconds: "5", new_status: "investigating" }] });
  };

  const removeStep = (idx: number) => {
    setForm({ ...form, steps: form.steps.filter((_, i) => i !== idx) });
  };

  const updateStep = (idx: number, field: string, value: string) => {
    const steps = [...form.steps];
    (steps[idx] as any)[field] = value;
    setForm({ ...form, steps });
  };

  const toggleRunbook = async (id: string, enabled: boolean) => {
    await supabase.from("runbooks").update({ enabled } as any).eq("id", id);
    fetchRunbooks();
  };

  const deleteRunbook = async (id: string) => {
    await supabase.from("runbooks").delete().eq("id", id);
    toast({ title: "Runbook deleted" });
    fetchRunbooks();
  };

  const manualExecute = async (rb: Runbook) => {
    setExecuting(rb.id);
    try {
      const { data, error } = await supabase.functions.invoke("execute-runbook", {
        body: { user_id: user!.id, runbook_id: rb.id },
      });
      if (error) throw error;
      toast({ title: `Runbook executed`, description: `${data?.executed || 0} runbook(s) ran successfully` });
      fetchData();
    } catch (err: any) {
      toast({ title: "Execution failed", description: err.message, variant: "destructive" });
    } finally {
      setExecuting(null);
    }
  };

  const statusBadge = (status: string) => {
    if (status === "completed") return "bg-chart-2/15 text-chart-2 border-chart-2/30";
    if (status === "failed") return "bg-destructive/15 text-destructive border-destructive/30";
    return "bg-warning/15 text-warning border-warning/30";
  };

  const runbookName = (id: string) => runbooks.find((r) => r.id === id)?.name || "Unknown";

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Runbook Automation</h1>
          <p className="text-sm text-muted-foreground">Define playbooks that auto-execute when incidents are detected</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-2 h-4 w-4" />Create Runbook</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Create Runbook</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-2">
              {/* Presets */}
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Quick Presets</Label>
                <div className="flex flex-wrap gap-2">
                  {presetRunbooks.map((p) => (
                    <Button key={p.name} variant="outline" size="sm" className="text-xs" onClick={() => usePreset(p)}>
                      {p.name}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <Label>Name</Label>
                <Input placeholder="e.g. Auto-Scale on High CPU" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label>Description</Label>
                <Input placeholder="What this runbook does..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>

              {/* Trigger conditions */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Trigger Metric</Label>
                  <Select value={form.triggerMetric} onValueChange={(v) => setForm({ ...form, triggerMetric: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any Metric</SelectItem>
                      <SelectItem value="cpu">CPU</SelectItem>
                      <SelectItem value="memory">Memory</SelectItem>
                      <SelectItem value="latency">Latency</SelectItem>
                      <SelectItem value="error_rate">Error Rate</SelectItem>
                      <SelectItem value="disk">Disk</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Trigger Severity</Label>
                  <Select value={form.triggerSeverity} onValueChange={(v) => setForm({ ...form, triggerSeverity: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      <SelectItem value="warning">Warning</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-xs">Cooldown (minutes)</Label>
                <Input type="number" value={form.cooldown} onChange={(e) => setForm({ ...form, cooldown: e.target.value })} />
              </div>

              {/* Steps */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Remediation Steps</Label>
                  <Button variant="outline" size="sm" onClick={addStep}><Plus className="mr-1 h-3 w-3" />Add Step</Button>
                </div>
                <div className="space-y-3">
                  {form.steps.map((step, i) => (
                    <div key={i} className="rounded-lg border border-border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground font-mono">Step {i + 1}</span>
                        {form.steps.length > 1 && (
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeStep(i)}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        )}
                      </div>
                      <Select value={step.action} onValueChange={(v) => updateStep(i, "action", v)}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {actionOptions.map((a) => (
                            <SelectItem key={a.value} value={a.value}>{a.label} — {a.desc}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {(step.action === "scale_up") && (
                        <div className="grid grid-cols-2 gap-2">
                          <Input placeholder="Server name" className="h-8 text-xs" value={step.server_name} onChange={(e) => updateStep(i, "server_name", e.target.value)} />
                          <Input placeholder="Instance count" className="h-8 text-xs" type="number" value={step.count} onChange={(e) => updateStep(i, "count", e.target.value)} />
                        </div>
                      )}
                      {step.action === "restart_service" && (
                        <Input placeholder="Service name" className="h-8 text-xs" value={step.service_name} onChange={(e) => updateStep(i, "service_name", e.target.value)} />
                      )}
                      {(step.action === "notify_team" || step.action === "create_log") && (
                        <Input placeholder="Message" className="h-8 text-xs" value={step.message} onChange={(e) => updateStep(i, "message", e.target.value)} />
                      )}
                      {step.action === "update_incident" && (
                        <Select value={step.new_status} onValueChange={(v) => updateStep(i, "new_status", v)}>
                          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="investigating">Investigating</SelectItem>
                            <SelectItem value="mitigating">Mitigating</SelectItem>
                            <SelectItem value="resolved">Resolved</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                      {step.action === "wait" && (
                        <Input placeholder="Seconds" className="h-8 text-xs" type="number" value={step.seconds} onChange={(e) => updateStep(i, "seconds", e.target.value)} />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <Button className="w-full" onClick={createRunbook}>Create Runbook</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Runbooks", value: runbooks.length, icon: BookOpen, color: "text-primary" },
          { label: "Active", value: runbooks.filter((r) => r.enabled).length, icon: Zap, color: "text-chart-2" },
          { label: "Executions", value: executions.length, icon: Play, color: "text-muted-foreground" },
          { label: "Failed", value: executions.filter((e) => e.status === "failed").length, icon: XCircle, color: "text-destructive" },
        ].map(({ label, value, icon: Icon, color }, i) => (
          <motion.div key={label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="border-border/50">
              <CardContent className="flex items-center gap-3 p-4">
                <Icon className={`h-5 w-5 ${color}`} />
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-xl font-bold font-mono">{value}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Runbook list */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Playbooks</h2>
        {runbooks.map((rb, i) => (
          <motion.div key={rb.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
            <Card className="border-border/50">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <Switch checked={rb.enabled} onCheckedChange={(v) => toggleRunbook(rb.id, v)} />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{rb.name}</p>
                      <Badge variant="outline" className="text-[10px]">
                        {rb.trigger_conditions?.metric || "any"} · {rb.trigger_conditions?.severity || "any"}
                      </Badge>
                    </div>
                    {rb.description && <p className="text-xs text-muted-foreground mt-0.5">{rb.description}</p>}
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                      <span>{rb.steps?.length || 0} steps</span>
                      <span>Cooldown: {rb.cooldown_minutes}m</span>
                      {rb.last_triggered_at && <span>Last run: {formatDistanceToNow(new Date(rb.last_triggered_at), { addSuffix: true })}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" onClick={() => manualExecute(rb)} disabled={executing === rb.id}>
                    {executing === rb.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Play className="mr-1 h-3 w-3" />}
                    Run
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteRunbook(rb.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
        {runbooks.length === 0 && (
          <Card className="border-dashed border-2">
            <CardContent className="flex flex-col items-center py-12 text-center">
              <BookOpen className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <h3 className="text-lg font-semibold">No runbooks defined</h3>
              <p className="mt-1 text-sm text-muted-foreground max-w-sm">
                Create automated playbooks to respond to incidents. Use presets to get started quickly.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Execution History */}
      {executions.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Execution History</h2>
          {executions.slice(0, 20).map((exec, i) => (
            <motion.div key={exec.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}>
              <Card
                className="border-border/50 cursor-pointer hover:border-primary/30 transition-colors"
                onClick={() => setSelectedExec(exec)}
              >
                <CardContent className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-3">
                    {exec.status === "completed" ? <CheckCircle className="h-4 w-4 text-chart-2" /> : exec.status === "failed" ? <XCircle className="h-4 w-4 text-destructive" /> : <Loader2 className="h-4 w-4 text-warning animate-spin" />}
                    <div>
                      <p className="text-sm font-medium">{runbookName(exec.runbook_id)}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className={`text-[9px] ${statusBadge(exec.status)}`}>{exec.status}</Badge>
                        <span className="text-[10px] text-muted-foreground">{exec.steps_completed?.length || 0} steps</span>
                        <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(exec.started_at), { addSuffix: true })}</span>
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Execution Detail Sheet */}
      <Sheet open={!!selectedExec} onOpenChange={() => setSelectedExec(null)}>
        <SheetContent className="w-[500px] sm:max-w-[500px] overflow-y-auto">
          {selectedExec && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Execution Detail
                </SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Card className="border-border/50">
                    <CardContent className="p-3 text-center">
                      <p className="text-xs text-muted-foreground">Status</p>
                      <Badge variant="outline" className={`mt-1 ${statusBadge(selectedExec.status)}`}>{selectedExec.status}</Badge>
                    </CardContent>
                  </Card>
                  <Card className="border-border/50">
                    <CardContent className="p-3 text-center">
                      <p className="text-xs text-muted-foreground">Steps</p>
                      <p className="text-lg font-bold">{selectedExec.steps_completed?.length || 0}</p>
                    </CardContent>
                  </Card>
                </div>

                <div>
                  <p className="text-sm font-medium mb-3">Step Results</p>
                  <div className="space-y-2">
                    {(selectedExec.steps_completed || []).map((step: any, i: number) => (
                      <div key={i} className="flex items-start gap-3 rounded-lg border border-border/50 p-3">
                        {step.status === "completed" ? <CheckCircle className="h-4 w-4 text-chart-2 mt-0.5 shrink-0" /> : step.status === "failed" ? <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" /> : <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />}
                        <div className="min-w-0">
                          <p className="text-xs font-medium">{actionOptions.find((a) => a.value === step.action)?.label || step.action}</p>
                          {step.detail && <p className="text-xs text-muted-foreground mt-0.5">{step.detail}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedExec.error_message && (
                  <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
                    <p className="text-xs text-destructive">{selectedExec.error_message}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
