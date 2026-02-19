import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { BarChart3 } from "lucide-react";
import { format, subHours, subDays } from "date-fns";

const timeRanges = [
  { label: "1 hour", value: "1h", fn: () => subHours(new Date(), 1) },
  { label: "6 hours", value: "6h", fn: () => subHours(new Date(), 6) },
  { label: "24 hours", value: "24h", fn: () => subDays(new Date(), 1) },
  { label: "7 days", value: "7d", fn: () => subDays(new Date(), 7) },
];

const metricTypes = ["cpu", "memory", "disk", "network", "latency", "error_rate"];
const chartConfig = Object.fromEntries(metricTypes.map((t, i) => [t, { label: t.replace("_", " ").toUpperCase(), color: `hsl(var(--chart-${(i % 5) + 1}))` }]));

export default function Metrics() {
  const { user } = useAuth();
  const [range, setRange] = useState("1h");
  const [selectedMetric, setSelectedMetric] = useState("cpu");
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const fetchMetrics = async () => {
      const rangeConfig = timeRanges.find((r) => r.value === range);
      if (!rangeConfig) return;

      const { data: servers } = await supabase.from("servers").select("id").eq("user_id", user.id).limit(1);
      if (!servers?.length) return;

      const { data } = await supabase
        .from("metrics")
        .select("value, recorded_at")
        .eq("server_id", servers[0].id)
        .eq("metric_type", selectedMetric)
        .gte("recorded_at", rangeConfig.fn().toISOString())
        .order("recorded_at", { ascending: true });

      if (data) {
        setChartData(
          data.map((d) => ({
            time: format(new Date(d.recorded_at), range === "7d" ? "MMM dd" : "HH:mm"),
            value: Math.round(d.value * 100) / 100,
          }))
        );
      }
    };
    fetchMetrics();
  }, [user, range, selectedMetric]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Metrics</h1>
          <p className="text-sm text-muted-foreground">Time-series performance data</p>
        </div>
        <div className="flex gap-3">
          <Select value={selectedMetric} onValueChange={setSelectedMetric}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {metricTypes.map((t) => <SelectItem key={t} value={t}>{t.replace("_", " ").toUpperCase()}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {timeRanges.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-sm font-medium">{selectedMetric.replace("_", " ").toUpperCase()}</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <ChartContainer config={chartConfig} className="h-[400px] w-full">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="time" className="text-muted-foreground" tick={{ fontSize: 12 }} />
                <YAxis className="text-muted-foreground" tick={{ fontSize: 12 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line type="monotone" dataKey="value" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
              </LineChart>
            </ChartContainer>
          ) : (
            <div className="flex flex-col items-center py-20 text-center">
              <BarChart3 className="mb-4 h-10 w-10 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">No metric data yet. Add a server and generate telemetry.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
