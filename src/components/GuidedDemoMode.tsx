import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Rocket, Loader2, CheckCircle2, ArrowRight, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

const tourSteps = [
  { label: "Generating telemetry spike…", action: "generate" },
  { label: "Detecting anomalies…", action: "detect" },
  { label: "Opening Incidents…", action: "navigate", path: "/incidents" },
  { label: "Opening Incident Story…", action: "story" },
  { label: "Opening Traces (Critical Path)…", action: "navigate", path: "/traces" },
  { label: "Tour complete!", action: "done" },
];

export default function GuidedDemoMode() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(-1);
  const [minimized, setMinimized] = useState(false);

  const runTour = async () => {
    setRunning(true);
    setMinimized(false);
    try {
      // Step 0: Generate telemetry
      setStep(0);
      const { error: telErr } = await supabase.functions.invoke("generate-telemetry");
      if (telErr) throw telErr;
      await new Promise((r) => setTimeout(r, 800));

      // Step 1: Detect anomalies
      setStep(1);
      const { error: anomErr } = await supabase.functions.invoke("detect-anomalies");
      if (anomErr) throw anomErr;
      await new Promise((r) => setTimeout(r, 800));

      // Step 2: Navigate to incidents
      setStep(2);
      navigate("/incidents");
      await new Promise((r) => setTimeout(r, 2000));

      // Step 3: Find latest incident and open story
      setStep(3);
      const { data: incidents } = await supabase
        .from("incidents")
        .select("id")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1);
      if (incidents?.length) {
        navigate(`/incidents/${incidents[0].id}/story`);
      }
      await new Promise((r) => setTimeout(r, 3000));

      // Step 4: Navigate to traces
      setStep(4);
      navigate("/traces");
      await new Promise((r) => setTimeout(r, 2000));

      // Step 5: Done
      setStep(5);
      toast({ title: "🎉 Guided demo complete!", description: "You've seen the full ObserveX workflow." });
    } catch (err: any) {
      toast({ title: "Demo error", description: err.message, variant: "destructive" });
    } finally {
      setTimeout(() => {
        setRunning(false);
        setStep(-1);
      }, 3000);
    }
  };

  if (!running && step === -1) {
    return (
      <Button onClick={runTour} size="sm" className="gap-1.5 bg-primary hover:bg-primary/90">
        <Rocket className="h-4 w-4" />
        Guided Demo Tour
      </Button>
    );
  }

  return (
    <AnimatePresence>
      {running && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-6 right-6 z-50 w-72"
        >
          <div className="rounded-xl border border-primary/30 bg-card shadow-2xl shadow-primary/10 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-primary/10 border-b border-primary/20">
              <div className="flex items-center gap-2">
                <Rocket className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">Guided Demo</span>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setRunning(false); setStep(-1); }}>
                <X className="h-3 w-3" />
              </Button>
            </div>
            <div className="p-4 space-y-2">
              {tourSteps.map((s, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: i <= step ? 1 : 0.3, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-2 text-xs"
                >
                  {i < step ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                  ) : i === step ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
                  ) : (
                    <div className="h-3.5 w-3.5 rounded-full border border-muted-foreground/30 shrink-0" />
                  )}
                  <span className={i <= step ? "text-foreground" : "text-muted-foreground"}>{s.label}</span>
                </motion.div>
              ))}
            </div>
            {/* Progress bar */}
            <div className="h-1 bg-secondary">
              <motion.div
                className="h-full bg-primary"
                animate={{ width: `${((step + 1) / tourSteps.length) * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
