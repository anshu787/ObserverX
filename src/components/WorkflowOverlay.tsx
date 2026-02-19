import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Activity, Brain, GitBranch, Zap, DollarSign, ArrowRight, X } from "lucide-react";

const steps = [
  { icon: Activity, label: "Telemetry", desc: "Metrics, logs & traces ingested" },
  { icon: Brain, label: "AI Correlation", desc: "Pattern matching across signals" },
  { icon: GitBranch, label: "Incident Story", desc: "Visual timeline with root cause" },
  { icon: Zap, label: "Suggested Fix", desc: "AI-guided remediation steps" },
  { icon: DollarSign, label: "Business Impact", desc: "Cost & downtime quantified" },
];

const STORAGE_KEY = "observex-onboarding-seen";

export default function WorkflowOverlay() {
  const [show, setShow] = useState(false);
  const [activeStep, setActiveStep] = useState(-1);

  useEffect(() => {
    const seen = localStorage.getItem(STORAGE_KEY);
    if (!seen) {
      setTimeout(() => setShow(true), 800);
    }
  }, []);

  useEffect(() => {
    if (!show) return;
    const timer = setInterval(() => {
      setActiveStep((prev) => {
        if (prev >= steps.length - 1) {
          clearInterval(timer);
          return prev;
        }
        return prev + 1;
      });
    }, 600);
    return () => clearInterval(timer);
  }, [show]);

  const dismiss = () => {
    setShow(false);
    localStorage.setItem(STORAGE_KEY, "true");
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background/90 backdrop-blur-md p-4"
          onClick={dismiss}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", damping: 25 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg"
          >
            <div className="rounded-2xl border border-primary/20 bg-card shadow-2xl shadow-primary/10 overflow-hidden">
              <div className="px-6 pt-6 pb-2 text-center">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary mb-3">
                  <Activity className="h-3 w-3" /> ObserveX Workflow
                </div>
                <h2 className="text-xl font-bold">How ObserveX Works</h2>
                <p className="text-xs text-muted-foreground mt-1 italic">
                  The AI Reliability Engineer that explains incidents before users notice them.
                </p>
              </div>

              <div className="px-6 py-6">
                <div className="flex items-center justify-between">
                  {steps.map((step, i) => {
                    const Icon = step.icon;
                    const isActive = i <= activeStep;
                    return (
                      <div key={i} className="flex items-center">
                        <motion.div
                          initial={{ scale: 0.5, opacity: 0 }}
                          animate={{
                            scale: isActive ? 1 : 0.7,
                            opacity: isActive ? 1 : 0.3,
                          }}
                          transition={{ delay: i * 0.1, type: "spring" }}
                          className="flex flex-col items-center text-center"
                        >
                          <div className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${isActive ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <p className={`text-[10px] font-semibold mt-1.5 ${isActive ? "text-foreground" : "text-muted-foreground"}`}>{step.label}</p>
                          <p className="text-[9px] text-muted-foreground max-w-[70px] leading-tight mt-0.5">{step.desc}</p>
                        </motion.div>
                        {i < steps.length - 1 && (
                          <motion.div
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: i < activeStep ? 1 : 0.3 }}
                            className="mx-1"
                          >
                            <ArrowRight className={`h-3 w-3 ${i < activeStep ? "text-primary" : "text-muted-foreground/30"}`} />
                          </motion.div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="px-6 pb-6 flex items-center justify-between">
                <p className="text-[10px] text-muted-foreground">From raw signal to actionable fix — <span className="text-primary font-medium">under 30 seconds</span></p>
                <Button size="sm" onClick={dismiss} className="gap-1.5">
                  Got it <ArrowRight className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
