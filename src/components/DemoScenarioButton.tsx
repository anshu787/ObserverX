import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Rocket, Loader2, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

const steps = [
  "Generating telemetry spike…",
  "Creating anomaly detection…",
  "Triggering incident & alerts…",
  "Updating service health…",
  "Running AI explanation…",
];

export default function DemoScenarioButton() {
  const { toast } = useToast();
  const [running, setRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [done, setDone] = useState(false);

  const runDemo = async () => {
    setRunning(true);
    setDone(false);
    try {
      setCurrentStep(0);
      await new Promise((r) => setTimeout(r, 600));

      setCurrentStep(1);
      const { error: telErr } = await supabase.functions.invoke("generate-telemetry");
      if (telErr) throw telErr;

      setCurrentStep(2);
      await new Promise((r) => setTimeout(r, 400));
      const { error: anomErr } = await supabase.functions.invoke("detect-anomalies");
      if (anomErr) throw anomErr;

      setCurrentStep(3);
      await new Promise((r) => setTimeout(r, 400));

      setCurrentStep(4);
      await new Promise((r) => setTimeout(r, 800));

      setDone(true);
      toast({ title: "Demo scenario complete!", description: "Explore incidents, alerts, and AI analysis now." });
      setTimeout(() => window.location.reload(), 1500);
    } catch (err: any) {
      toast({ title: "Demo failed", description: err.message, variant: "destructive" });
    } finally {
      setRunning(false);
    }
  };

  const BeforeAfterOverlay = () => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-3 grid grid-cols-2 gap-2 text-[11px] rounded-lg border border-border/50 overflow-hidden"
    >
      <div className="p-2.5 bg-destructive/5 space-y-1">
        <p className="font-semibold text-destructive text-[10px] uppercase tracking-wider">Without ObserveX</p>
        <p className="flex items-center gap-1 text-muted-foreground">❌ 3–4 hour debugging</p>
        <p className="flex items-center gap-1 text-muted-foreground">❌ Manual log searching</p>
        <p className="flex items-center gap-1 text-muted-foreground">❌ Guesswork triage</p>
      </div>
      <div className="p-2.5 bg-success/5 space-y-1">
        <p className="font-semibold text-success text-[10px] uppercase tracking-wider">With ObserveX</p>
        <p className="flex items-center gap-1 text-foreground">✅ Root cause in 30s</p>
        <p className="flex items-center gap-1 text-foreground">✅ AI-guided fix</p>
        <p className="flex items-center gap-1 text-foreground">✅ Auto-diagnosed</p>
      </div>
    </motion.div>
  );

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold text-sm">Live Demo Scenario</h3>
            <p className="text-xs text-muted-foreground">One-click full incident lifecycle</p>
          </div>
          <Button
            onClick={runDemo}
            disabled={running}
            size="sm"
            className="bg-primary hover:bg-primary/90"
          >
            {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}
            {running ? "Running…" : "Start Demo Scenario"}
          </Button>
        </div>
        <AnimatePresence>
          {(running || done) && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="space-y-1.5 overflow-hidden"
            >
              {steps.map((s, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: i <= currentStep ? 1 : 0.3, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-center gap-2 text-xs"
                >
                  {i < currentStep || done ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                  ) : i === currentStep ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
                  ) : (
                    <div className="h-3.5 w-3.5 rounded-full border border-muted-foreground/30 shrink-0" />
                  )}
                  <span className={i <= currentStep || done ? "text-foreground" : "text-muted-foreground"}>{s}</span>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {done && <BeforeAfterOverlay />}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
