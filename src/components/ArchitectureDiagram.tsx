import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, Network, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const pipelineSteps = [
  { label: "Telemetry", desc: "Metrics, logs, traces ingested in real-time", color: "bg-chart-2" },
  { label: "AI Correlation", desc: "Pattern matching across all signals", color: "bg-primary" },
  { label: "Incident Story", desc: "Visual timeline with root cause", color: "bg-warning" },
  { label: "Suggested Fix", desc: "AI-guided remediation steps", color: "bg-success" },
];

export default function ArchitectureDiagram() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-1.5">
        <Network className="h-4 w-4" />
        How It Works
      </Button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg"
            >
              <Card className="border-primary/20">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="font-bold text-lg">How ObserveX Works</h3>
                      <p className="text-xs text-muted-foreground">End-to-end AI reliability pipeline</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setOpen(false)} className="h-8 w-8">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {pipelineSteps.map((step, i) => (
                      <div key={step.label} className="flex items-center gap-3">
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: i * 0.15 }}
                          className={`flex h-10 w-10 items-center justify-center rounded-lg ${step.color} text-white font-bold text-sm shrink-0`}
                        >
                          {i + 1}
                        </motion.div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm">{step.label}</p>
                          <p className="text-xs text-muted-foreground">{step.desc}</p>
                        </div>
                        {i < pipelineSteps.length - 1 && (
                          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 hidden sm:block" />
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 pt-4 border-t border-border/50 text-center">
                    <p className="text-xs text-muted-foreground">
                      From raw signal to actionable fix — <span className="text-primary font-medium">under 30 seconds</span>
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
