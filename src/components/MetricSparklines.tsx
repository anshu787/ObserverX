import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Cpu, MemoryStick, HardDrive, Wifi, Activity, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { LineChart, Line, ReferenceLine, ResponsiveContainer, YAxis } from "recharts";

interface MetricHistory {
  type: string;
  label: string;
  icon: typeof Cpu;
  unit: string;
  threshold: number;
  data: { value: number; projected?: boolean }[];
  current: number;
  color: string;
}

const metricConfigs = [
  { type: "cpu", label: "CPU", icon: Cpu, unit: "%", threshold: 95, color: "hsl(var(--chart-1))" },
  { type: "memory", label: "Memory", icon: MemoryStick, unit: "%", threshold: 95, color: "hsl(var(--chart-2))" },
  { type: "disk", label: "Disk", icon: HardDrive, unit: "%", threshold: 90, color: "hsl(var(--chart-3))" },
  { type: "network", label: "Network", icon: Wifi, unit: "Mbps", threshold: 100, color: "hsl(var(--chart-4))" },
  { type: "latency", label: "Latency", icon: Activity, unit: "ms", threshold: 500, color: "hsl(var(--warning))" },
  { type: "error_rate", label: "Errors", icon: AlertTriangle, unit: "%", threshold: 10, color: "hsl(var(--destructive))" },
];

function projectTrend(data: { value: number }[], steps: number): { value: number; projected: boolean }[] {
  if (data.length < 3) return [];
  const n = data.length;
  const last3 = data.slice(-3);
  const avgSlope = (last3[2].value - last3[0].value) / 2;
  const projected: { value: number; projected: boolean }[] = [];
  let lastVal = data[n - 1].value;
  for (let i = 0; i < steps; i++) {
    lastVal = Math.max(0, lastVal + avgSlope);
    projected.push({ value: Math.round(lastVal * 10) / 10, projected: true });
  }
  return projected;
}

export default function MetricSparklines() {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<MetricHistory[]>([]);

  useEffect(() => {
    if (!user) return;

    const fetchHistory = async () => {
      const { data: servers } = await supabase.from("servers").select("id").eq("user_id", user.id).limit(1);
      if (!servers?.length) return;

      const results: MetricHistory[] = [];
      for (const config of metricConfigs) {
        const { data } = await supabase
          .from("metrics")
          .select("value, recorded_at")
          .eq("server_id", servers[0].id)
          .eq("metric_type", config.type)
          .order("recorded_at", { ascending: true })
          .limit(20);

        const points = (data || []).map((d) => ({ value: Math.round(d.value * 10) / 10, projected: false }));
        const projected = projectTrend(points, 5);
        const current = points.length > 0 ? points[points.length - 1].value : 0;

        results.push({
          ...config,
          data: [...points, ...projected],
          current,
        });
      }
      setMetrics(results);
    };

    fetchHistory();
  }, [user]);

  if (metrics.length === 0 || metrics.every((m) => m.data.length === 0)) return null;

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">Metric Trends & Projections</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((m, i) => {
          const Icon = m.icon;
          const hasProjected = m.data.some((d) => d.projected);
          const actualCount = m.data.filter((d) => !d.projected).length;

          return (
            <motion.div key={m.type} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
              <Card className="border-border/50">
                <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4">
                  <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5" />
                    {m.label}
                  </CardTitle>
                  <span className="text-sm font-bold font-mono">{m.current}{m.unit}</span>
                </CardHeader>
                <CardContent className="px-2 pb-3 pt-0">
                  <div className="h-16">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={m.data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                        <YAxis domain={[0, "auto"]} hide />
                        <ReferenceLine
                          y={m.threshold}
                          stroke="hsl(var(--destructive))"
                          strokeDasharray="4 3"
                          strokeWidth={1}
                          strokeOpacity={0.6}
                        />
                        {/* Actual data line */}
                        <Line
                          dataKey="value"
                          stroke={m.color}
                          strokeWidth={2}
                          dot={false}
                          isAnimationActive={true}
                          animationDuration={1000}
                          connectNulls
                          data={m.data.slice(0, actualCount)}
                        />
                        {/* Full line with projection dashed */}
                        {hasProjected && (
                          <Line
                            dataKey="value"
                            stroke={m.color}
                            strokeWidth={1.5}
                            strokeDasharray="4 3"
                            strokeOpacity={0.5}
                            dot={false}
                            isAnimationActive={false}
                          />
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex items-center justify-between mt-1 px-2">
                    <span className="text-[10px] text-muted-foreground/60">past</span>
                    {hasProjected && (
                      <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
                        <span className="inline-block w-3 border-t border-dashed border-muted-foreground/40" />
                        projected
                      </span>
                    )}
                    <span className="text-[10px] text-destructive/60">threshold: {m.threshold}{m.unit}</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
