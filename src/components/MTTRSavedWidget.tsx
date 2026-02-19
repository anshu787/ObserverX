import { Card, CardContent } from "@/components/ui/card";
import { Clock } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export default function MTTRSavedWidget() {
  const { user } = useAuth();
  const [mttrMinutes, setMttrMinutes] = useState(192); // 3h 12m default

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data } = await supabase
        .from("incidents")
        .select("started_at, resolved_at")
        .eq("user_id", user.id)
        .not("resolved_at", "is", null);

      if (data?.length) {
        let totalSaved = 0;
        data.forEach((inc) => {
          const actual = (new Date(inc.resolved_at!).getTime() - new Date(inc.started_at).getTime()) / 60000;
          // Traditional MTTR is ~3x longer
          totalSaved += Math.max(actual * 2, 20);
        });
        setMttrMinutes(Math.round(totalSaved));
      }
    };
    fetch();
  }, [user]);

  const hours = Math.floor(mttrMinutes / 60);
  const mins = mttrMinutes % 60;

  return (
    <Card className="border-chart-2/30 bg-chart-2/5">
      <CardContent className="p-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-2/20 shrink-0">
          <Clock className="h-5 w-5 text-chart-2" />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">MTTR Saved</p>
          <motion.p
            key={mttrMinutes}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xl font-bold font-mono text-chart-2"
          >
            {hours}h {mins}m
          </motion.p>
        </div>
        <p className="ml-auto text-[10px] text-muted-foreground max-w-[100px] text-right">vs traditional debugging</p>
      </CardContent>
    </Card>
  );
}
