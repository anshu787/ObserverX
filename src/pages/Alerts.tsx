import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Bell, Check, Plus, Trash2, Settings2, Zap, Copy, Eye } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

interface Alert {
  id: string;
  name: string;
  severity: string;
  status: string;
  message: string | null;
  ai_message: string | null;
  triggered_at: string;
}

interface AlertRule {
  id: string;
  name: string;
  enabled: boolean;
  metric_type: string;
  operator: string;
  threshold: number;
  duration_seconds: number;
  severity: string;
  correlation_metric: string | null;
  correlation_operator: string | null;
  correlation_threshold: number | null;
}

const severityColor: Record<string, string> = {
  info: "bg-chart-2/15 text-chart-2 border-chart-2/30",
  warning: "bg-warning/15 text-warning border-warning/30",
  critical: "bg-destructive/15 text-destructive border-destructive/30",
};

const metricOptions = ["cpu", "memory", "disk", "network", "latency", "error_rate"];
const operatorOptions = [">", "<", ">=", "<=", "="];
const operatorLabels: Record<string, string> = { ">": "exceeds", "<": "drops below", ">=": "reaches", "<=": "at most", "=": "equals" };

const metricUnits: Record<string, string> = {
  cpu: "%", memory: "%", disk: "%", network: "Mbps", latency: "ms", error_rate: "%",
};

const rulePresets = [
  { name: "High CPU Alert", metric: "cpu", op: ">", threshold: 85, severity: "warning", duration: 60 },
  { name: "Critical Memory", metric: "memory", op: ">", threshold: 95, severity: "critical", duration: 30 },
  { name: "Disk Full Warning", metric: "disk", op: ">", threshold: 90, severity: "warning", duration: 120 },
  { name: "High Latency", metric: "latency", op: ">", threshold: 300, severity: "critical", duration: 30, corrMetric: "error_rate", corrOp: ">", corrThreshold: 5 },
  { name: "Error Rate Spike", metric: "error_rate", op: ">", threshold: 5, severity: "critical", duration: 60 },
];

export default function Alerts() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);

  // New rule form
  const [ruleName, setRuleName] = useState("");
  const [ruleMetric, setRuleMetric] = useState("cpu");
  const [ruleOp, setRuleOp] = useState(">");
  const [ruleThreshold, setRuleThreshold] = useState(80);
  const [ruleDuration, setRuleDuration] = useState(60);
  const [ruleSeverity, setRuleSeverity] = useState("warning");
  const [corrEnabled, setCorrEnabled] = useState(false);
  const [corrMetric, setCorrMetric] = useState("latency");
  const [corrOp, setCorrOp] = useState(">");
  const [corrThreshold, setCorrThreshold] = useState(200);

  const fetchAlerts = async () => {
    if (!user) return;
    const { data } = await supabase.from("alerts").select("*").eq("user_id", user.id).order("triggered_at", { ascending: false });
    if (data) setAlerts(data as Alert[]);
  };

  const fetchRules = async () => {
    if (!user) return;
    const { data } = await supabase.from("alert_rules").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    if (data) setRules(data as AlertRule[]);
  };

  useEffect(() => {
    fetchAlerts();
    fetchRules();
    const channel = supabase
      .channel("alerts-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, () => fetchAlerts())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const acknowledge = async (id: string) => {
    await supabase.from("alerts").update({ status: "acknowledged", acknowledged_at: new Date().toISOString() }).eq("id", id);
    fetchAlerts();
    toast({ title: "Alert acknowledged" });
  };

  const resolve = async (id: string) => {
    await supabase.from("alerts").update({ status: "resolved", resolved_at: new Date().toISOString() }).eq("id", id);
    fetchAlerts();
    toast({ title: "Alert resolved" });
  };

  const applyPreset = (preset: typeof rulePresets[0]) => {
    setRuleName(preset.name);
    setRuleMetric(preset.metric);
    setRuleOp(preset.op);
    setRuleThreshold(preset.threshold);
    setRuleSeverity(preset.severity);
    setRuleDuration(preset.duration);
    if ((preset as any).corrMetric) {
      setCorrEnabled(true);
      setCorrMetric((preset as any).corrMetric);
      setCorrOp((preset as any).corrOp);
      setCorrThreshold((preset as any).corrThreshold);
    } else {
      setCorrEnabled(false);
    }
  };

  const openEditRule = (rule: AlertRule) => {
    setEditingRule(rule);
    setRuleName(rule.name);
    setRuleMetric(rule.metric_type);
    setRuleOp(rule.operator);
    setRuleThreshold(rule.threshold);
    setRuleDuration(rule.duration_seconds);
    setRuleSeverity(rule.severity);
    if (rule.correlation_metric) {
      setCorrEnabled(true);
      setCorrMetric(rule.correlation_metric);
      setCorrOp(rule.correlation_operator || ">");
      setCorrThreshold(rule.correlation_threshold || 0);
    } else {
      setCorrEnabled(false);
    }
    setRuleDialogOpen(true);
  };

  const saveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const ruleData = {
      name: ruleName,
      metric_type: ruleMetric,
      operator: ruleOp,
      threshold: ruleThreshold,
      duration_seconds: ruleDuration,
      severity: ruleSeverity,
      correlation_metric: corrEnabled ? corrMetric : null,
      correlation_operator: corrEnabled ? corrOp : null,
      correlation_threshold: corrEnabled ? corrThreshold : null,
    };

    if (editingRule) {
      const { error } = await supabase.from("alert_rules").update(ruleData).eq("id", editingRule.id);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Rule updated" });
    } else {
      const { error } = await supabase.from("alert_rules").insert({ ...ruleData, user_id: user.id });
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Rule created" });
    }

    setRuleDialogOpen(false);
    resetRuleForm();
    fetchRules();
  };

  const resetRuleForm = () => {
    setEditingRule(null);
    setRuleName(""); setRuleMetric("cpu"); setRuleOp(">"); setRuleThreshold(80);
    setRuleDuration(60); setRuleSeverity("warning"); setCorrEnabled(false); setCorrMetric("latency"); setCorrOp(">"); setCorrThreshold(200);
  };

  const toggleRule = async (id: string, enabled: boolean) => {
    await supabase.from("alert_rules").update({ enabled }).eq("id", id);
    fetchRules();
  };

  const deleteRule = async (id: string) => {
    await supabase.from("alert_rules").delete().eq("id", id);
    fetchRules();
    toast({ title: "Rule deleted" });
  };

  const duplicateRule = async (rule: AlertRule) => {
    if (!user) return;
    await supabase.from("alert_rules").insert({
      user_id: user.id, name: `${rule.name} (copy)`, metric_type: rule.metric_type, operator: rule.operator,
      threshold: rule.threshold, duration_seconds: rule.duration_seconds, severity: rule.severity,
      correlation_metric: rule.correlation_metric, correlation_operator: rule.correlation_operator,
      correlation_threshold: rule.correlation_threshold,
    });
    fetchRules();
    toast({ title: "Rule duplicated" });
  };

  // Build human-readable rule description
  const ruleDescription = () => {
    const metric = ruleMetric.replace("_", " ");
    const unit = metricUnits[ruleMetric] || "";
    let desc = `Alert when **${metric}** ${operatorLabels[ruleOp] || ruleOp} **${ruleThreshold}${unit}**`;
    if (corrEnabled) {
      const corrUnit = metricUnits[corrMetric] || "";
      desc += ` AND **${corrMetric.replace("_", " ")}** ${operatorLabels[corrOp] || corrOp} **${corrThreshold}${corrUnit}**`;
    }
    desc += ` for ${ruleDuration}s`;
    return desc;
  };

  // Threshold slider config per metric
  const thresholdConfig: Record<string, { min: number; max: number; step: number }> = {
    cpu: { min: 0, max: 100, step: 1 },
    memory: { min: 0, max: 100, step: 1 },
    disk: { min: 0, max: 100, step: 1 },
    network: { min: 0, max: 10000, step: 10 },
    latency: { min: 0, max: 2000, step: 10 },
    error_rate: { min: 0, max: 100, step: 0.5 },
  };

  const config = thresholdConfig[ruleMetric] || { min: 0, max: 100, step: 1 };
  const corrConfig = thresholdConfig[corrMetric] || { min: 0, max: 100, step: 1 };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Alerts</h1>
          <p className="text-sm text-muted-foreground">Smart alerting with correlation & AI-enhanced messages</p>
        </div>
      </div>

      <Tabs defaultValue="alerts">
        <TabsList>
          <TabsTrigger value="alerts">Active Alerts</TabsTrigger>
          <TabsTrigger value="rules">Alert Rules</TabsTrigger>
        </TabsList>

        <TabsContent value="alerts" className="space-y-4 mt-4">
          {alerts.map((alert, i) => (
            <motion.div key={alert.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="border-border/50">
                <CardHeader className="flex flex-row items-start justify-between pb-2">
                  <div className="flex items-center gap-3">
                    <Bell className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <CardTitle className="text-base">{alert.name}</CardTitle>
                      <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(alert.triggered_at), { addSuffix: true })}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={severityColor[alert.severity]}>{alert.severity}</Badge>
                    <Badge variant="outline" className="capitalize">{alert.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {alert.ai_message && (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                      <p className="text-xs font-medium text-primary mb-1">AI Analysis</p>
                      <p className="text-sm">{alert.ai_message}</p>
                    </div>
                  )}
                  {alert.message && <p className="text-sm text-muted-foreground">{alert.message}</p>}
                  {alert.status === "active" && (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => acknowledge(alert.id)}>Acknowledge</Button>
                      <Button variant="outline" size="sm" onClick={() => resolve(alert.id)}><Check className="mr-1 h-3 w-3" />Resolve</Button>
                    </div>
                  )}
                  {alert.status === "acknowledged" && (
                    <Button variant="outline" size="sm" onClick={() => resolve(alert.id)}><Check className="mr-1 h-3 w-3" />Resolve</Button>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
          {alerts.length === 0 && (
            <Card className="border-dashed border-2">
              <CardContent className="flex flex-col items-center py-12 text-center">
                <Bell className="mb-4 h-12 w-12 text-muted-foreground/50" />
                <h3 className="text-lg font-semibold">No alerts</h3>
                <p className="mt-1 text-sm text-muted-foreground">Everything is quiet.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="rules" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Dialog open={ruleDialogOpen} onOpenChange={(open) => { setRuleDialogOpen(open); if (!open) resetRuleForm(); }}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" />New Rule</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingRule ? "Edit Alert Rule" : "Create Alert Rule"}</DialogTitle>
                </DialogHeader>

                {/* Presets */}
                {!editingRule && (
                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">Quick Presets</Label>
                    <div className="flex flex-wrap gap-2">
                      {rulePresets.map((preset) => (
                        <Button key={preset.name} variant="outline" size="sm" className="text-xs" onClick={() => applyPreset(preset)}>
                          <Zap className="mr-1 h-3 w-3" />{preset.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                <form onSubmit={saveRule} className="space-y-5">
                  <div>
                    <Label className="text-xs text-muted-foreground">Rule Name</Label>
                    <Input placeholder="e.g. High CPU Alert" value={ruleName} onChange={(e) => setRuleName(e.target.value)} required />
                  </div>

                  {/* Primary condition */}
                  <div className="rounded-lg border border-border p-4 space-y-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Primary Condition</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">Metric</Label>
                        <Select value={ruleMetric} onValueChange={(v) => { setRuleMetric(v); setRuleThreshold(thresholdConfig[v]?.max ? Math.round(thresholdConfig[v].max * 0.8) : 80); }}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{metricOptions.map((m) => <SelectItem key={m} value={m}>{m.replace("_", " ").toUpperCase()}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Operator</Label>
                        <Select value={ruleOp} onValueChange={setRuleOp}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{operatorOptions.map((o) => <SelectItem key={o} value={o}>{o} ({operatorLabels[o]})</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Threshold</Label>
                        <Input type="number" value={ruleThreshold} onChange={(e) => setRuleThreshold(parseFloat(e.target.value) || 0)} required />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Label className="text-xs text-muted-foreground">Threshold: {ruleThreshold}{metricUnits[ruleMetric]}</Label>
                      </div>
                      <Slider value={[ruleThreshold]} onValueChange={([v]) => setRuleThreshold(v)} min={config.min} max={config.max} step={config.step} />
                    </div>
                  </div>

                  {/* Duration & Severity */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Duration (seconds)</Label>
                      <div className="flex items-center gap-2">
                        <Slider value={[ruleDuration]} onValueChange={([v]) => setRuleDuration(v)} min={10} max={600} step={10} className="flex-1" />
                        <span className="text-xs font-mono w-10 text-right">{ruleDuration}s</span>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Severity</Label>
                      <Select value={ruleSeverity} onValueChange={setRuleSeverity}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="info">ℹ️ Info</SelectItem>
                          <SelectItem value="warning">⚠️ Warning</SelectItem>
                          <SelectItem value="critical">🔴 Critical</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Correlation condition */}
                  <div className="rounded-lg border border-border p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Correlation Condition</p>
                      <Switch checked={corrEnabled} onCheckedChange={setCorrEnabled} />
                    </div>
                    <AnimatePresence>
                      {corrEnabled && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                          <p className="text-xs text-muted-foreground mb-3">Alert only fires when BOTH conditions are true simultaneously.</p>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <Label className="text-xs text-muted-foreground">Metric</Label>
                              <Select value={corrMetric} onValueChange={setCorrMetric}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>{metricOptions.filter((m) => m !== ruleMetric).map((m) => <SelectItem key={m} value={m}>{m.replace("_", " ").toUpperCase()}</SelectItem>)}</SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Operator</Label>
                              <Select value={corrOp} onValueChange={setCorrOp}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>{operatorOptions.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Threshold</Label>
                              <Input type="number" value={corrThreshold} onChange={(e) => setCorrThreshold(parseFloat(e.target.value) || 0)} />
                            </div>
                          </div>
                          <div className="mt-3">
                            <Slider value={[corrThreshold]} onValueChange={([v]) => setCorrThreshold(v)} min={corrConfig.min} max={corrConfig.max} step={corrConfig.step} />
                            <p className="text-xs text-muted-foreground mt-1 text-right">{corrThreshold}{metricUnits[corrMetric]}</p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Live Preview */}
                  <div className="rounded-lg bg-secondary/50 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Eye className="h-3 w-3 text-muted-foreground" />
                      <p className="text-xs font-medium text-muted-foreground">Rule Preview</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={severityColor[ruleSeverity]}>{ruleSeverity}</Badge>
                      <p className="text-sm">
                        {ruleMetric.replace("_", " ")} {ruleOp} {ruleThreshold}{metricUnits[ruleMetric]}
                        {corrEnabled && <span className="text-primary font-medium"> AND {corrMetric.replace("_", " ")} {corrOp} {corrThreshold}{metricUnits[corrMetric]}</span>}
                        <span className="text-muted-foreground"> for {ruleDuration}s</span>
                      </p>
                    </div>
                  </div>

                  <Button type="submit" className="w-full">{editingRule ? "Update Rule" : "Create Rule"}</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {rules.map((rule, i) => (
            <motion.div key={rule.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className={`border-border/50 ${!rule.enabled ? "opacity-50" : ""}`}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    <Switch checked={rule.enabled} onCheckedChange={(v) => toggleRule(rule.id, v)} />
                    <div>
                      <p className="font-medium text-sm">{rule.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {rule.metric_type.replace("_", " ")} {rule.operator} {rule.threshold}{metricUnits[rule.metric_type] || ""}
                        {rule.correlation_metric && (
                          <span className="text-primary"> AND {rule.correlation_metric.replace("_", " ")} {rule.correlation_operator} {rule.correlation_threshold}{metricUnits[rule.correlation_metric] || ""}</span>
                        )}
                        <span className="text-muted-foreground/60"> • {rule.duration_seconds}s</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant="outline" className={severityColor[rule.severity]}>{rule.severity}</Badge>
                    <Button variant="ghost" size="icon" onClick={() => openEditRule(rule)} title="Edit">
                      <Settings2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => duplicateRule(rule)} title="Duplicate">
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteRule(rule.id)} title="Delete">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}

          {rules.length === 0 && (
            <Card className="border-dashed border-2">
              <CardContent className="flex flex-col items-center py-12 text-center">
                <Settings2 className="mb-4 h-12 w-12 text-muted-foreground/50" />
                <h3 className="text-lg font-semibold">No alert rules</h3>
                <p className="mt-1 text-sm text-muted-foreground">Create rules to get alerted on metric thresholds.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
