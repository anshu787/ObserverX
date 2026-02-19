import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, AlertTriangle, Cpu, HardDrive, Loader2, MemoryStick, Server, Wifi, Zap, Sparkles, Brain } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import PredictiveAlerts from "@/components/PredictiveAlerts";
import MetricSparklines from "@/components/MetricSparklines";
import ExecSummaryWidget from "@/components/ExecSummaryWidget";
import DemoScenarioButton from "@/components/DemoScenarioButton";
import AIThinkingPanel from "@/components/AIThinkingPanel";
import ValueSavedCounter from "@/components/ValueSavedCounter";
import ComparisonView from "@/components/ComparisonView";
import AITrustLayer from "@/components/AITrustLayer";
import ArchitectureDiagram from "@/components/ArchitectureDiagram";
import MTTRSavedWidget from "@/components/MTTRSavedWidget";
import GuidedDemoMode from "@/components/GuidedDemoMode";
import WorkflowOverlay from "@/components/WorkflowOverlay";

interface Stats {
  totalServers: number;
  healthyServers: number;
  activeIncidents: number;
  activeAlerts: number;
}

const statCards = [
  { key: "totalServers" as const, label: "Total Servers", icon: Server, color: "text-chart-2" },
  { key: "healthyServers" as const, label: "Healthy", icon: Activity, color: "text-success" },
  { key: "activeIncidents" as const, label: "Active Incidents", icon: Zap, color: "text-destructive" },
  { key: "activeAlerts" as const, label: "Active Alerts", icon: AlertTriangle, color: "text-warning" },
];

const metricTypes = [
  { type: "cpu", label: "CPU Usage", icon: Cpu, unit: "%", value: 0 },
  { type: "memory", label: "Memory", icon: MemoryStick, unit: "%", value: 0 },
  { type: "disk", label: "Disk I/O", icon: HardDrive, unit: "%", value: 0 },
  { type: "network", label: "Network", icon: Wifi, unit: "Mbps", value: 0 },
  { type: "latency", label: "Latency", icon: Activity, unit: "ms", value: 0 },
  { type: "error_rate", label: "Error Rate", icon: AlertTriangle, unit: "%", value: 0 },
];

function getHealthColor(value: number, type: string) {
  if (type === "error_rate") {
    if (value < 1) return "text-success";
    if (value < 5) return "text-warning";
    return "text-destructive";
  }
  if (type === "latency") {
    if (value < 100) return "text-success";
    if (value < 300) return "text-warning";
    return "text-destructive";
  }
  if (value < 60) return "text-success";
  if (value < 80) return "text-warning";
  return "text-destructive";
}

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [stats, setStats] = useState<Stats>({ totalServers: 0, healthyServers: 0, activeIncidents: 0, activeAlerts: 0 });
  const [latestMetrics, setLatestMetrics] = useState(metricTypes);
  const [generating, setGenerating] = useState(false);
  const [detecting, setDetecting] = useState(false);

  useEffect(() => {
    if (!user) return;
    
    const fetchStats = async () => {
      const [servers, incidents, alerts] = await Promise.all([
        supabase.from("servers").select("id, status").eq("user_id", user.id),
        supabase.from("incidents").select("id").eq("user_id", user.id).eq("status", "active"),
        supabase.from("alerts").select("id").eq("user_id", user.id).eq("status", "active"),
      ]);

      setStats({
        totalServers: servers.data?.length ?? 0,
        healthyServers: servers.data?.filter((s) => s.status === "healthy").length ?? 0,
        activeIncidents: incidents.data?.length ?? 0,
        activeAlerts: alerts.data?.length ?? 0,
      });
    };

    const fetchLatestMetrics = async () => {
      const { data: servers } = await supabase.from("servers").select("id").eq("user_id", user.id).limit(1);
      if (!servers?.length) return;

      const { data: metrics } = await supabase
        .from("metrics")
        .select("metric_type, value")
        .eq("server_id", servers[0].id)
        .order("recorded_at", { ascending: false })
        .limit(6);

      if (metrics?.length) {
        setLatestMetrics((prev) =>
          prev.map((m) => {
            const found = metrics.find((met) => met.metric_type === m.type);
            return found ? { ...m, value: Math.round(found.value * 10) / 10 } : m;
          })
        );
      }
    };

    fetchStats();
    fetchLatestMetrics();

    // Realtime subscription for metrics
    const channel = supabase
      .channel("dashboard-metrics")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "metrics" }, () => {
        fetchLatestMetrics();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "incidents" }, () => {
        fetchStats();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, () => {
        fetchStats();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const generateDemoData = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-telemetry");
      if (error) throw error;
      toast({ title: "Demo data generated!", description: data?.spikeScenario ? "Spike scenario with incident & alerts." : "Normal metrics generated." });
      window.location.reload();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const runAnomalyDetection = async () => {
    setDetecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("detect-anomalies");
      if (error) throw error;
      const count = data?.anomalies?.length || 0;
      const incidents = data?.incidentsCreated || 0;
      toast({
        title: count > 0 ? `${count} anomal${count === 1 ? "y" : "ies"} detected` : "No anomalies found",
        description: incidents > 0 ? `${incidents} critical incident(s) auto-created.` : "All metrics within normal ranges.",
        variant: count > 0 ? "destructive" : "default",
      });
    } catch (err: any) {
      toast({ title: "Detection failed", description: err.message, variant: "destructive" });
    } finally {
      setDetecting(false);
    }
  };

  const overallHealth = stats.totalServers > 0
    ? Math.round((stats.healthyServers / stats.totalServers) * 100)
    : 100;

  return (
    <div className="p-6 space-y-6">
      {/* Workflow Overlay (first login) */}
      <WorkflowOverlay />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">System Overview</h1>
          <p className="text-xs text-muted-foreground italic">The AI Reliability Engineer that explains incidents before users notice them.</p>
        </div>
        <div className="flex items-center gap-3">
          <GuidedDemoMode />
          <ArchitectureDiagram />
          <Button variant="outline" size="sm" onClick={runAnomalyDetection} disabled={detecting}>
            {detecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Brain className="mr-2 h-4 w-4" />}
            {detecting ? "Analyzing..." : "AI Anomaly Scan"}
          </Button>
          <Button variant="outline" size="sm" onClick={generateDemoData} disabled={generating}>
            {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            {generating ? "Generating..." : "Generate Demo Data"}
          </Button>
          <div className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium ${overallHealth > 80 ? "border-success/30 bg-success/10 text-success" : overallHealth > 50 ? "border-warning/30 bg-warning/10 text-warning" : "border-destructive/30 bg-destructive/10 text-destructive"}`}>
            <div className={`h-2 w-2 rounded-full animate-pulse-glow ${overallHealth > 80 ? "bg-success" : overallHealth > 50 ? "bg-warning" : "bg-destructive"}`} />
            Health: {overallHealth}%
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map(({ key, label, icon: Icon, color }, i) => (
          <motion.div key={key} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <Card className="border-border/50">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-secondary">
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="text-2xl font-bold font-mono">{stats[key]}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* MTTR Saved */}
      <MTTRSavedWidget />

      {/* Live Metrics */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">Live Metrics</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {latestMetrics.map(({ type, label, icon: Icon, unit, value }, i) => (
            <motion.div key={type} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 + i * 0.08 }}>
              <Card className="border-border/50">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-3xl font-bold font-mono ${getHealthColor(value, type)}`}>{value}</span>
                    <span className="text-sm text-muted-foreground">{unit}</span>
                  </div>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <motion.div
                      className={`h-full rounded-full ${value < 60 ? "bg-success" : value < 80 ? "bg-warning" : "bg-destructive"}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(value, 100)}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                    />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Demo Scenario + AI Thinking + Value Saved */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <DemoScenarioButton />
        <AIThinkingPanel />
        <ValueSavedCounter />
      </div>

      {/* Metric Trend Sparklines + Exec Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <MetricSparklines />
        </div>
        <ExecSummaryWidget />
      </div>

      {/* Predictive Failure Detection */}
      <PredictiveAlerts />

      {/* Comparison + Trust Layer */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ComparisonView />
        <AITrustLayer />
      </div>

      {/* Empty state guidance */}
      {stats.totalServers === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
          <Card className="border-dashed border-2 border-border">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Server className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <h3 className="text-lg font-semibold">No servers connected</h3>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Add your first server to start monitoring. Go to <span className="font-medium text-primary">Servers</span> to get started.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
