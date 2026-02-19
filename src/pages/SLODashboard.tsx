import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Target, Plus, Trash2, Clock, Activity, TrendingDown, Shield } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

interface SLO {
  id: string;
  service_id: string;
  name: string;
  slo_type: string;
  target_percentage: number;
  latency_threshold_ms: number | null;
  window_days: number;
  created_at: string;
}

interface Service {
  id: string;
  name: string;
  type: string;
  status: string;
  health_score: number;
}

interface SLOStatus {
  slo: SLO;
  serviceName: string;
  current: number;
  budgetRemaining: number;
  budgetUsedPct: number;
  status: "healthy" | "warning" | "breached";
}

export default function SLODashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [slos, setSlos] = useState<SLO[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [sloStatuses, setSloStatuses] = useState<SLOStatus[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: "", service_id: "", slo_type: "uptime", target_percentage: "99.9", latency_threshold_ms: "200", window_days: "30" });

  useEffect(() => {
    if (!user) return;
    fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    const [sloRes, svcRes] = await Promise.all([
      supabase.from("slo_definitions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("services").select("id, name, type, status, health_score").eq("user_id", user.id),
    ]);
    const sloData = (sloRes.data || []) as SLO[];
    const svcData = (svcRes.data || []) as Service[];
    setSlos(sloData);
    setServices(svcData);

    // Calculate SLO statuses by checking traces/metrics
    const statuses: SLOStatus[] = [];
    for (const slo of sloData) {
      const svc = svcData.find((s) => s.id === slo.service_id);
      const serviceName = svc?.name || "Unknown";
      const windowStart = new Date(Date.now() - slo.window_days * 86400000).toISOString();

      if (slo.slo_type === "uptime") {
        // Calculate uptime from traces (ok vs error)
        const { data: traces } = await supabase
          .from("traces")
          .select("status")
          .eq("service_id", slo.service_id)
          .gte("started_at", windowStart);
        const total = traces?.length || 0;
        const ok = traces?.filter((t: any) => t.status === "ok").length || 0;
        const current = total > 0 ? (ok / total) * 100 : 100;
        const errorBudgetTotal = 100 - slo.target_percentage;
        const errorBudgetUsed = 100 - current;
        const budgetUsedPct = errorBudgetTotal > 0 ? Math.min((errorBudgetUsed / errorBudgetTotal) * 100, 100) : 0;
        const budgetRemaining = Math.max(errorBudgetTotal - errorBudgetUsed, 0);
        statuses.push({
          slo, serviceName, current: Math.round(current * 1000) / 1000,
          budgetRemaining: Math.round(budgetRemaining * 1000) / 1000,
          budgetUsedPct: Math.round(budgetUsedPct * 10) / 10,
          status: budgetUsedPct >= 100 ? "breached" : budgetUsedPct >= 75 ? "warning" : "healthy",
        });
      } else {
        // Latency SLO: % of traces under threshold
        const { data: traces } = await supabase
          .from("traces")
          .select("duration_ms")
          .eq("service_id", slo.service_id)
          .gte("started_at", windowStart);
        const total = traces?.length || 0;
        const underThreshold = traces?.filter((t: any) => t.duration_ms <= (slo.latency_threshold_ms || 200)).length || 0;
        const current = total > 0 ? (underThreshold / total) * 100 : 100;
        const errorBudgetTotal = 100 - slo.target_percentage;
        const errorBudgetUsed = 100 - current;
        const budgetUsedPct = errorBudgetTotal > 0 ? Math.min((errorBudgetUsed / errorBudgetTotal) * 100, 100) : 0;
        const budgetRemaining = Math.max(errorBudgetTotal - errorBudgetUsed, 0);
        statuses.push({
          slo, serviceName, current: Math.round(current * 1000) / 1000,
          budgetRemaining: Math.round(budgetRemaining * 1000) / 1000,
          budgetUsedPct: Math.round(budgetUsedPct * 10) / 10,
          status: budgetUsedPct >= 100 ? "breached" : budgetUsedPct >= 75 ? "warning" : "healthy",
        });
      }
    }
    setSloStatuses(statuses);
  };

  const createSLO = async () => {
    if (!user || !form.name || !form.service_id) return;
    const { error } = await supabase.from("slo_definitions").insert({
      user_id: user.id,
      name: form.name,
      service_id: form.service_id,
      slo_type: form.slo_type,
      target_percentage: parseFloat(form.target_percentage),
      latency_threshold_ms: form.slo_type === "latency" ? parseFloat(form.latency_threshold_ms) : null,
      window_days: parseInt(form.window_days),
    });
    if (error) {
      toast({ title: "Error creating SLO", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "SLO created" });
      setDialogOpen(false);
      setForm({ name: "", service_id: "", slo_type: "uptime", target_percentage: "99.9", latency_threshold_ms: "200", window_days: "30" });
      fetchData();
    }
  };

  const deleteSLO = async (id: string) => {
    await supabase.from("slo_definitions").delete().eq("id", id);
    toast({ title: "SLO deleted" });
    fetchData();
  };

  const statusColor = (s: string) => s === "breached" ? "text-destructive" : s === "warning" ? "text-warning" : "text-chart-2";
  const statusBg = (s: string) => s === "breached" ? "bg-destructive/15 border-destructive/30" : s === "warning" ? "bg-warning/15 border-warning/30" : "bg-chart-2/15 border-chart-2/30";
  const budgetBarColor = (s: string) => s === "breached" ? "bg-destructive" : s === "warning" ? "bg-warning" : "bg-chart-2";

  const summary = {
    total: sloStatuses.length,
    healthy: sloStatuses.filter((s) => s.status === "healthy").length,
    warning: sloStatuses.filter((s) => s.status === "warning").length,
    breached: sloStatuses.filter((s) => s.status === "breached").length,
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">SLO Dashboard</h1>
          <p className="text-sm text-muted-foreground">Track uptime and latency budgets per service</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-2 h-4 w-4" />Define SLO</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Define Service Level Objective</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <Label>Name</Label>
                <Input placeholder="e.g. API Uptime" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label>Service</Label>
                <Select value={form.service_id} onValueChange={(v) => setForm({ ...form, service_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select service" /></SelectTrigger>
                  <SelectContent>
                    {services.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Type</Label>
                <Select value={form.slo_type} onValueChange={(v) => setForm({ ...form, slo_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="uptime">Uptime</SelectItem>
                    <SelectItem value="latency">Latency</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Target (%)</Label>
                  <Input type="number" step="0.1" value={form.target_percentage} onChange={(e) => setForm({ ...form, target_percentage: e.target.value })} />
                </div>
                <div>
                  <Label>Window (days)</Label>
                  <Input type="number" value={form.window_days} onChange={(e) => setForm({ ...form, window_days: e.target.value })} />
                </div>
              </div>
              {form.slo_type === "latency" && (
                <div>
                  <Label>Latency threshold (ms)</Label>
                  <Input type="number" value={form.latency_threshold_ms} onChange={(e) => setForm({ ...form, latency_threshold_ms: e.target.value })} />
                </div>
              )}
              <Button className="w-full" onClick={createSLO}>Create SLO</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary cards */}
      {summary.total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total SLOs", value: summary.total, icon: Target, color: "text-primary" },
            { label: "Healthy", value: summary.healthy, icon: Shield, color: "text-chart-2" },
            { label: "Warning", value: summary.warning, icon: TrendingDown, color: "text-warning" },
            { label: "Breached", value: summary.breached, icon: Activity, color: "text-destructive" },
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
      )}

      {/* SLO cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sloStatuses.map((s, i) => (
          <motion.div key={s.slo.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
            <Card className="border-border/50">
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <div>
                  <CardTitle className="text-base">{s.slo.name}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.serviceName} · {s.slo.window_days}d window</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`text-[10px] ${statusBg(s.status)}`}>
                    {s.status === "breached" ? "BREACHED" : s.status === "warning" ? "WARNING" : "HEALTHY"}
                  </Badge>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteSLO(s.slo.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{s.slo.slo_type === "uptime" ? "Current Uptime" : `Requests < ${s.slo.latency_threshold_ms}ms`}</p>
                    <p className={`text-2xl font-bold font-mono ${statusColor(s.status)}`}>{s.current}%</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Target</p>
                    <p className="text-lg font-mono font-medium">{s.slo.target_percentage}%</p>
                  </div>
                </div>

                {/* Error budget bar */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-muted-foreground">Error Budget Used</span>
                    <span className={`font-mono font-medium ${statusColor(s.status)}`}>{s.budgetUsedPct}%</span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-secondary overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${budgetBarColor(s.status)}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(s.budgetUsedPct, 100)}%` }}
                      transition={{ duration: 0.8, delay: i * 0.06 }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {s.budgetRemaining > 0 ? `${s.budgetRemaining}% budget remaining` : "Error budget exhausted"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {sloStatuses.length === 0 && (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center py-12 text-center">
            <Target className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="text-lg font-semibold">No SLOs defined</h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-sm">
              Define Service Level Objectives to track uptime and latency budgets for your services.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
