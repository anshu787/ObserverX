import { Card, CardContent } from "@/components/ui/card";
import { X, Check } from "lucide-react";

const rows = [
  { traditional: "Alerts after failure", observex: "Predicts issues" },
  { traditional: "Manual debugging", observex: "AI explains root cause" },
  { traditional: "2–4 hr MTTR", observex: "Minutes to resolve" },
  { traditional: "Siloed dashboards", observex: "Unified story timeline" },
  { traditional: "Guesswork triage", observex: "Confidence-scored AI" },
];

export default function ComparisonView() {
  return (
    <Card className="border-border/50">
      <CardContent className="p-5">
        <h3 className="font-semibold text-sm mb-3">Traditional Monitoring vs ObserveX</h3>
        <div className="rounded-lg border border-border overflow-hidden text-xs">
          <div className="grid grid-cols-2 bg-secondary/60 font-medium">
            <div className="px-3 py-2 text-muted-foreground">Traditional</div>
            <div className="px-3 py-2 text-primary">ObserveX</div>
          </div>
          {rows.map((row, i) => (
            <div key={i} className={`grid grid-cols-2 ${i % 2 === 0 ? "" : "bg-secondary/20"}`}>
              <div className="px-3 py-2 flex items-center gap-1.5 text-muted-foreground">
                <X className="h-3 w-3 text-destructive shrink-0" />
                {row.traditional}
              </div>
              <div className="px-3 py-2 flex items-center gap-1.5 text-foreground">
                <Check className="h-3 w-3 text-success shrink-0" />
                {row.observex}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
