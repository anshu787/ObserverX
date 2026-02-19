import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, CheckCircle2, AlertTriangle, XCircle, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface StatusPage {
  id: string;
  page_title: string;
  page_description: string | null;
  logo_url: string | null;
}

interface PageService {
  id: string;
  display_name: string;
  display_order: number;
  service_id: string;
}

interface ServiceHealth {
  id: string;
  status: string;
  health_score: number;
}

interface PageIncident {
  id: string;
  title: string;
  message: string | null;
  status: string;
  severity: string;
  started_at: string;
  resolved_at: string | null;
}

const statusConfig: Record<string, { icon: any; label: string; color: string; dot: string }> = {
  healthy: { icon: CheckCircle2, label: "Operational", color: "text-emerald-500", dot: "bg-emerald-500" },
  degraded: { icon: AlertTriangle, label: "Degraded", color: "text-amber-500", dot: "bg-amber-500" },
  critical: { icon: XCircle, label: "Major Outage", color: "text-red-500", dot: "bg-red-500" },
  unknown: { icon: Clock, label: "Unknown", color: "text-muted-foreground", dot: "bg-muted-foreground" },
};

export default function PublicStatusPage() {
  const { slug } = useParams<{ slug: string }>();
  const [page, setPage] = useState<StatusPage | null>(null);
  const [services, setServices] = useState<(PageService & { health?: ServiceHealth })[]>([]);
  const [incidents, setIncidents] = useState<PageIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!slug) { setNotFound(true); setLoading(false); return; }

      // Fetch status page config
      const { data: pageData } = await supabase
        .from("status_page_config")
        .select("*")
        .eq("slug", slug)
        .eq("enabled", true)
        .single();

      if (!pageData) { setNotFound(true); setLoading(false); return; }
      setPage(pageData as StatusPage);

      // Fetch services and incidents in parallel
      const [svcRes, incRes] = await Promise.all([
        supabase.from("status_page_services").select("*").eq("status_page_id", pageData.id).order("display_order"),
        supabase.from("status_page_incidents").select("*").eq("status_page_id", pageData.id).order("started_at", { ascending: false }).limit(20),
      ]);

      const pageSvcs = (svcRes.data || []) as PageService[];
      setIncidents((incRes.data || []) as PageIncident[]);

      // Fetch real service health - these are public via the status_page_services policy
      // But services table has RLS - we need to handle this gracefully
      const serviceIds = pageSvcs.map((s) => s.service_id);
      if (serviceIds.length > 0) {
        const { data: healthData } = await supabase
          .from("services")
          .select("id, status, health_score")
          .in("id", serviceIds);

        const healthMap: Record<string, ServiceHealth> = {};
        (healthData || []).forEach((h: any) => { healthMap[h.id] = h; });

        setServices(pageSvcs.map((s) => ({ ...s, health: healthMap[s.service_id] })));
      } else {
        setServices(pageSvcs);
      }

      setLoading(false);
    };

    fetchData();
  }, [slug]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (notFound || !page) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-background">
        <Activity className="mb-4 h-12 w-12 text-muted-foreground/50" />
        <h1 className="text-xl font-bold">Status page not found</h1>
        <p className="text-sm text-muted-foreground mt-2">This page doesn't exist or has been disabled.</p>
      </div>
    );
  }

  const activeIncidents = incidents.filter((i) => i.status !== "resolved");
  const recentResolved = incidents.filter((i) => i.status === "resolved").slice(0, 5);
  const allOperational = services.every((s) => (s.health?.status || "unknown") === "healthy") && activeIncidents.length === 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-3xl px-6 py-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Activity className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{page.page_title}</h1>
              {page.page_description && <p className="text-sm text-muted-foreground">{page.page_description}</p>}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8 space-y-8">
        {/* Overall Status Banner */}
        <Card className={allOperational ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5"}>
          <CardContent className="flex items-center gap-3 py-4">
            {allOperational ? (
              <>
                <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                <span className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">All Systems Operational</span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-6 w-6 text-amber-500" />
                <span className="text-lg font-semibold text-amber-600 dark:text-amber-400">
                  {activeIncidents.length} Active Incident{activeIncidents.length !== 1 ? "s" : ""}
                </span>
              </>
            )}
          </CardContent>
        </Card>

        {/* Active Incidents */}
        {activeIncidents.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Active Incidents</h2>
            {activeIncidents.map((inc) => (
              <Card key={inc.id} className="border-warning/30">
                <CardContent className="py-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-warning" />
                      <span className="font-semibold">{inc.title}</span>
                    </div>
                    <Badge variant="outline" className="capitalize">{inc.status}</Badge>
                  </div>
                  {inc.message && <p className="text-sm text-muted-foreground">{inc.message}</p>}
                  <p className="text-xs text-muted-foreground">
                    Started {formatDistanceToNow(new Date(inc.started_at), { addSuffix: true })}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Services */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Services</h2>
          <Card>
            <CardContent className="divide-y divide-border py-0">
              {services.map((svc) => {
                const status = svc.health?.status || "unknown";
                const cfg = statusConfig[status] || statusConfig.unknown;
                const Icon = cfg.icon;
                return (
                  <div key={svc.id} className="flex items-center justify-between py-3">
                    <span className="text-sm font-medium">{svc.display_name}</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs ${cfg.color}`}>{cfg.label}</span>
                      <div className={`h-2.5 w-2.5 rounded-full ${cfg.dot}`} />
                    </div>
                  </div>
                );
              })}
              {services.length === 0 && (
                <div className="py-8 text-center text-sm text-muted-foreground">No services configured.</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Resolved Incidents */}
        {recentResolved.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Past Incidents</h2>
            {recentResolved.map((inc) => (
              <Card key={inc.id}>
                <CardContent className="py-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{inc.title}</span>
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px]">Resolved</Badge>
                  </div>
                  {inc.message && <p className="text-xs text-muted-foreground">{inc.message}</p>}
                  <p className="text-xs text-muted-foreground">
                    Resolved {inc.resolved_at ? formatDistanceToNow(new Date(inc.resolved_at), { addSuffix: true }) : "recently"}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Footer */}
        <footer className="text-center text-xs text-muted-foreground pt-8 pb-4">
          Powered by ObserveX
        </footer>
      </main>
    </div>
  );
}
