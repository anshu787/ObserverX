import { Card, CardContent } from "@/components/ui/card";
import { ShieldCheck, GitCompare, Activity, Clock } from "lucide-react";
import { motion } from "framer-motion";

const reasons = [
  { icon: Activity, text: "94 similar past patterns matched", color: "text-chart-2" },
  { icon: GitCompare, text: "Latency correlation detected (r=0.92)", color: "text-success" },
  { icon: Clock, text: "Deployment timestamp matched (2m before spike)", color: "text-warning" },
  { icon: ShieldCheck, text: "Log error pattern confirmed across 3 services", color: "text-primary" },
];

export default function AITrustLayer() {
  return (
    <Card className="border-primary/20 bg-primary/5 judge-highlight rounded-lg">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">Why AI believes this</h3>
          <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Trust Layer</span>
        </div>
        <div className="space-y-2.5">
          {reasons.map(({ icon: Icon, text, color }, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.12 }}
              className="flex items-start gap-2 text-xs"
            >
              <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${color}`} />
              <span className="text-foreground/90">{text}</span>
            </motion.div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between text-[10px] text-muted-foreground">
          <span>Overall confidence</span>
          <span className="font-mono font-bold text-success text-sm">94.2%</span>
        </div>
      </CardContent>
    </Card>
  );
}
