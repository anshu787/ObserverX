import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText, Loader2, TrendingUp, TrendingDown, Shield, AlertTriangle,
  CheckCircle, Clock, DollarSign, Server, Zap, Activity, BarChart3,
  ChevronRight, Lightbulb, Download
} from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

interface ReportStats {
  period: string;
  totalServers: number;
  healthyServers: number;
  avgHealthScore: number;
  totalIncidents: number;
  criticalIncidents: number;
  resolvedIncidents: number;
  activeIncidents: number;
  mttrMinutes: number;
  totalDowntime: number;
  uptimePercent: number;
  totalAlerts: number;
  criticalAlerts: number;
  avgCpu: number;
  avgErrorRate: number;
  avgLatency: number;
  estimatedCost: number;
}

interface AIReport {
  executive_summary: string;
  highlights: string[];
  concerns: string[];
  recommendations: string[];
  risk_level: string;
  sla_status: string;
}

const riskColors: Record<string, string> = {
  low: "bg-success/15 text-success border-success/30",
  medium: "bg-warning/15 text-warning border-warning/30",
  high: "bg-destructive/15 text-destructive border-destructive/30",
  critical: "bg-destructive/20 text-destructive border-destructive/40",
};

const slaColors: Record<string, string> = {
  met: "bg-success/15 text-success border-success/30",
  at_risk: "bg-warning/15 text-warning border-warning/30",
  breached: "bg-destructive/15 text-destructive border-destructive/30",
};

export default function ExecutiveSummary() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [report, setReport] = useState<AIReport | null>(null);

  const generateReport = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("executive-summary");
      if (error) throw error;
      setStats(data.stats);
      setReport(data.report);
      toast({ title: "Report generated", description: "Weekly reliability report is ready." });
    } catch (err: any) {
      toast({ title: "Report failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const exportReport = () => {
    if (!stats || !report) return;
    const text = `
WEEKLY RELIABILITY REPORT
=========================
Period: ${stats.period}
Generated: ${new Date().toISOString()}

EXECUTIVE SUMMARY
${report.executive_summary}

Risk Level: ${report.risk_level.toUpperCase()}
SLA Status: ${report.sla_status.toUpperCase()}

KEY METRICS
- Uptime: ${stats.uptimePercent}%
- Total Incidents: ${stats.totalIncidents} (${stats.criticalIncidents} critical)
- MTTR: ${stats.mttrMinutes} min
- Total Downtime: ${stats.totalDowntime} min
- Avg CPU: ${stats.avgCpu}%
- Avg Error Rate: ${stats.avgErrorRate}%
- Avg Latency: ${stats.avgLatency}ms
- Est. Cost Impact: $${stats.estimatedCost.toLocaleString()}

HIGHLIGHTS
${report.highlights.map((h) => `✓ ${h}`).join("\n")}

CONCERNS
${report.concerns.map((c) => `⚠ ${c}`).join("\n") || "None"}

RECOMMENDATIONS
${report.recommendations.map((r, i) => `${i + 1}. ${r}`).join("\n")}
`.trim();

    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reliability-report-${stats.period.replace(/ to /g, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            Executive Summary
          </h1>
          <p className="text-sm text-muted-foreground">One-click weekly reliability report for stakeholders</p>
        </div>
        <div className="flex items-center gap-2">
          {report && (
            <Button variant="outline" size="sm" onClick={exportReport}>
              <Download className="mr-2 h-4 w-4" /> Export
            </Button>
          )}
          <Button onClick={generateReport} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
            {loading ? "Generating..." : "Generate Report"}
          </Button>
        </div>
      </div>

      {!report && !loading && (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center py-16 text-center">
            <FileText className="mb-4 h-16 w-16 text-muted-foreground/30" />
            <h3 className="text-lg font-semibold">No report generated yet</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              Click "Generate Report" to create an AI-powered weekly reliability summary with uptime, incidents, cost impact, and actionable recommendations.
            </p>
          </CardContent>
        </Card>
      )}

      {report && stats && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {/* Header Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Uptime", value: `${stats.uptimePercent}%`, icon: Activity, good: stats.uptimePercent >= 99.5 },
              { label: "Incidents", value: stats.totalIncidents.toString(), icon: Zap, good: stats.totalIncidents === 0 },
              { label: "MTTR", value: `${stats.mttrMinutes}m`, icon: Clock, good: stats.mttrMinutes <= 30 },
              { label: "Cost Impact", value: `$${stats.estimatedCost.toLocaleString()}`, icon: DollarSign, good: stats.estimatedCost === 0 },
            ].map(({ label, value, icon: Icon, good }, i) => (
              <motion.div key={label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-muted-foreground">{label}</span>
                      <Icon className={`h-4 w-4 ${good ? "text-success" : "text-warning"}`} />
                    </div>
                    <p className="text-2xl font-bold font-mono">{value}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Risk & SLA badges */}
          <div className="flex items-center gap-3">
            <Badge variant="outline" className={`text-sm px-3 py-1 ${riskColors[report.risk_level]}`}>
              <Shield className="mr-1 h-3 w-3" /> Risk: {report.risk_level.toUpperCase()}
            </Badge>
            <Badge variant="outline" className={`text-sm px-3 py-1 ${slaColors[report.sla_status]}`}>
              <Activity className="mr-1 h-3 w-3" /> SLA: {report.sla_status.replace("_", " ").toUpperCase()}
            </Badge>
            <span className="text-xs text-muted-foreground ml-auto">Period: {stats.period}</span>
          </div>

          {/* Executive Summary */}
          <Card className="border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Executive Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed">{report.executive_summary}</p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Metrics */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" /> Infrastructure Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { label: "Servers", value: `${stats.healthyServers}/${stats.totalServers} healthy`, pct: stats.totalServers > 0 ? (stats.healthyServers / stats.totalServers) * 100 : 100 },
                    { label: "Avg Health Score", value: `${stats.avgHealthScore}/100`, pct: stats.avgHealthScore },
                    { label: "Avg CPU", value: `${stats.avgCpu}%`, pct: stats.avgCpu },
                    { label: "Avg Error Rate", value: `${stats.avgErrorRate}%`, pct: Math.min(stats.avgErrorRate * 10, 100) },
                    { label: "Avg Latency", value: `${stats.avgLatency}ms`, pct: Math.min(stats.avgLatency / 5, 100) },
                  ].map(({ label, value, pct }) => (
                    <div key={label} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-28 shrink-0">{label}</span>
                      <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${pct < 60 ? "bg-success" : pct < 80 ? "bg-warning" : "bg-destructive"}`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono w-20 text-right">{value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Incident Breakdown */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="h-4 w-4 text-destructive" /> Incident Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { label: "Total Incidents", value: stats.totalIncidents, color: "text-foreground" },
                    { label: "Critical", value: stats.criticalIncidents, color: "text-destructive" },
                    { label: "Resolved", value: stats.resolvedIncidents, color: "text-success" },
                    { label: "Still Active", value: stats.activeIncidents, color: "text-warning" },
                    { label: "Total Alerts", value: stats.totalAlerts, color: "text-foreground" },
                    { label: "Total Downtime", value: `${stats.totalDowntime} min`, color: stats.totalDowntime > 60 ? "text-destructive" : "text-foreground" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{label}</span>
                      <span className={`text-sm font-mono font-bold ${color}`}>{value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Highlights */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-success" /> Highlights
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {report.highlights.map((h, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-success shrink-0 mt-0.5" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Concerns */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-warning" /> Concerns
                </CardTitle>
              </CardHeader>
              <CardContent>
                {report.concerns.length > 0 ? (
                  <ul className="space-y-2">
                    {report.concerns.map((c, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">No concerns this week 🎉</p>
                )}
              </CardContent>
            </Card>

            {/* Recommendations */}
            <Card className="border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-primary" /> Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {report.recommendations.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-[10px] font-bold mt-0.5">
                        {i + 1}
                      </div>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </motion.div>
      )}
    </div>
  );
}
