import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Loader2, Clock, AlertTriangle, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

interface Prediction {
  server_id: string;
  server_name: string;
  metric_type: string;
  label: string;
  unit: string;
  minutesUntil: number;
  currentValue: number;
  trend: string;
  recommendation?: string;
}

export default function PredictiveAlerts() {
  const { toast } = useToast();
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasRun, setHasRun] = useState(false);

  const runAnalysis = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("predict-failures");
      if (error) throw error;
      setPredictions(data?.predictions || []);
      setHasRun(true);
      if (!data?.predictions?.length) {
        toast({ title: "All clear", description: "No failure predictions detected." });
      }
    } catch (err: any) {
      toast({ title: "Analysis failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const urgencyColor = (min: number) => {
    if (min <= 10) return "bg-destructive/15 text-destructive border-destructive/30";
    if (min <= 30) return "bg-warning/15 text-warning border-warning/30";
    return "bg-chart-2/15 text-chart-2 border-chart-2/30";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Predictive Failure Detection
          </h2>
          <p className="text-sm text-muted-foreground">AI-powered trend analysis warns before failures occur</p>
        </div>
        <Button onClick={runAnalysis} disabled={loading} variant="outline" size="sm">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          {loading ? "Analyzing..." : "Run Analysis"}
        </Button>
      </div>

      {predictions.length > 0 && (
        <div className="grid gap-3">
          {predictions.map((p, i) => (
            <motion.div key={`${p.server_id}-${p.metric_type}`} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}>
              <Card className="border-border/50">
                <CardContent className="flex items-start gap-4 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-warning/10">
                    <AlertTriangle className="h-5 w-5 text-warning" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm">{p.label}</span>
                      <Badge variant="outline" className={urgencyColor(p.minutesUntil)}>
                        <Clock className="mr-1 h-3 w-3" />
                        ~{p.minutesUntil} min
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-mono font-medium text-foreground">{p.server_name}</span>
                      {" — "}Current: <span className="font-mono">{p.currentValue}{p.unit}</span>, {p.trend}
                    </p>
                    {p.recommendation && (
                      <div className="mt-2 rounded border border-primary/20 bg-primary/5 p-2">
                        <p className="text-xs"><span className="font-medium text-primary">AI:</span> {p.recommendation}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {hasRun && predictions.length === 0 && (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center py-8 text-center">
            <TrendingUp className="mb-3 h-10 w-10 text-success/50" />
            <h3 className="text-sm font-semibold">No failures predicted</h3>
            <p className="mt-1 text-xs text-muted-foreground">All metrics are within safe trends.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
