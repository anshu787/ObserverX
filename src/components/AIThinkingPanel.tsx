import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Brain, CheckCircle2, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const analysisSteps = [
  "Analyzing signals…",
  "Metrics correlated",
  "Logs matched pattern",
  "Change event detected",
  "Generating explanation…",
];

export default function AIThinkingPanel() {
  const [activeStep, setActiveStep] = useState(0);
  const [cycling, setCycling] = useState(true);

  useEffect(() => {
    if (!cycling) return;
    const interval = setInterval(() => {
      setActiveStep((prev) => {
        if (prev >= analysisSteps.length - 1) {
          setTimeout(() => {
            setActiveStep(0);
          }, 3000);
          return prev;
        }
        return prev + 1;
      });
    }, 1800);
    return () => clearInterval(interval);
  }, [cycling]);

  return (
    <Card className="border-chart-2/30 bg-chart-2/5 judge-highlight rounded-lg">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-chart-2/20">
            <Brain className="h-4 w-4 text-chart-2" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">ObserveX AI is Thinking</h3>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Real-time analysis engine</p>
          </div>
          <div className="ml-auto h-2 w-2 rounded-full bg-chart-2 animate-pulse" />
        </div>

        <div className="space-y-2 font-mono text-xs">
          <AnimatePresence mode="wait">
            {analysisSteps.map((step, i) => (
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 5 }}
                animate={{
                  opacity: i <= activeStep ? 1 : 0.25,
                  y: 0,
                }}
                transition={{ delay: i * 0.05, duration: 0.3 }}
                className="flex items-center gap-2"
              >
                {i < activeStep ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                ) : i === activeStep ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-chart-2 shrink-0" />
                ) : (
                  <div className="h-3.5 w-3.5 shrink-0" />
                )}
                <span className={i <= activeStep ? "text-foreground" : "text-muted-foreground"}>
                  {i === 0 || i === analysisSteps.length - 1 ? step : `✓ ${step}`}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  );
}
