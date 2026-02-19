import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Loader2, Activity, Zap, Clock, DollarSign, Shield, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

interface MiniReport {
  stats: {
    uptimePercent: number;
    totalIncidents: number;
    criticalIncidents: number;
    mttrMinutes: number;
    estimatedCost: number;
    avgHealthScore: number;
  };
  report: {
    executive_summary: string;
    risk_level: string;
    sla_status: string;
  };
}

const riskColors: Record<string, string> = {
  low: "bg-success/15 text-success border-success/30",
  medium: "bg-warning/15 text-warning border-warning/30",
  high: "bg-destructive/15 text-destructive border-destructive/30",
  critical: "bg-destructive/20 text-destructive border-destructive/40",
};

export default function ExecSummaryWidget() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<MiniReport | null>(null);

  const generate = async () => {
    setLoading(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("executive-summary");
      if (error) throw error;
      setData(res);
    } catch (err: any) {
      toast({ title: "Report failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (!data) {
    return (
      <Card className="border-border/50">
        <CardContent className="flex flex-col items-center py-8 text-center">
          <FileText className="mb-3 h-10 w-10 text-muted-foreground/30" />
          <h3 className="text-sm font-semibold">Weekly Reliability Snapshot</h3>
          <p className="text-xs text-muted-foreground mt-1 mb-4 max-w-xs">
            Generate an AI-powered executive summary of the last 7 days.
          </p>
          <Button onClick={generate} disabled={loading} size="sm">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
            {loading ? "Generating..." : "Generate Snapshot"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { stats, report } = data;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="border-border/50">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Weekly Snapshot
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`text-[10px] ${riskColors[report.risk_level]}`}>
              <Shield className="mr-1 h-3 w-3" />{report.risk_level.toUpperCase()}
            </Badge>
            <Button variant="ghost" size="sm" onClick={generate} disabled={loading} className="h-7 w-7 p-0">
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Activity className="h-3 w-3" />}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* KPI row */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Uptime", value: `${stats.uptimePercent}%`, icon: Activity, good: stats.uptimePercent >= 99.5 },
              { label: "Incidents", value: String(stats.totalIncidents), icon: Zap, good: stats.totalIncidents === 0 },
              { label: "MTTR", value: `${stats.mttrMinutes}m`, icon: Clock, good: stats.mttrMinutes <= 30 },
              { label: "Cost", value: `$${stats.estimatedCost.toLocaleString()}`, icon: DollarSign, good: stats.estimatedCost === 0 },
            ].map(({ label, value, icon: Icon, good }) => (
              <div key={label} className="text-center">
                <Icon className={`h-4 w-4 mx-auto mb-1 ${good ? "text-success" : "text-warning"}`} />
                <p className="text-lg font-bold font-mono leading-none">{value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* AI Summary */}
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{report.executive_summary}</p>

          <Link to="/executive-summary">
            <Button variant="outline" size="sm" className="w-full">
              View Full Report <ChevronRight className="ml-1 h-3 w-3" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    </motion.div>
  );
}
