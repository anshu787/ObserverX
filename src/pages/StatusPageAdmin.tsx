import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Globe, Plus, Trash2, ExternalLink, AlertTriangle, Settings2, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

interface StatusPageConfig {
  id: string;
  page_title: string;
  page_description: string | null;
  logo_url: string | null;
  enabled: boolean;
  slug: string;
}

interface StatusPageService {
  id: string;
  status_page_id: string;
  service_id: string;
  display_name: string;
  display_order: number;
}

interface StatusPageIncident {
  id: string;
  status_page_id: string;
  title: string;
  message: string | null;
  status: string;
  severity: string;
  started_at: string;
  resolved_at: string | null;
}

interface Service {
  id: string;
  name: string;
  status: string;
  health_score: number;
}

const incidentStatuses = ["investigating", "identified", "monitoring", "resolved"];
const severityOptions = ["info", "warning", "critical"];

export default function StatusPageAdmin() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [configs, setConfigs] = useState<StatusPageConfig[]>([]);
  const [pageServices, setPageServices] = useState<Record<string, StatusPageService[]>>({});
  const [pageIncidents, setPageIncidents] = useState<Record<string, StatusPageIncident[]>>({});
  const [services, setServices] = useState<Service[]>([]);

  // Config dialog
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [cfgTitle, setCfgTitle] = useState("System Status");
  const [cfgDesc, setCfgDesc] = useState("");
  const [cfgSlug, setCfgSlug] = useState("");

  // Add service dialog
  const [svcDialogOpen, setSvcDialogOpen] = useState(false);
  const [svcPageId, setSvcPageId] = useState("");
  const [svcServiceId, setSvcServiceId] = useState("");
  const [svcDisplayName, setSvcDisplayName] = useState("");

  // Incident dialog
  const [incDialogOpen, setIncDialogOpen] = useState(false);
  const [incPageId, setIncPageId] = useState("");
  const [incTitle, setIncTitle] = useState("");
  const [incMessage, setIncMessage] = useState("");
  const [incSeverity, setIncSeverity] = useState("warning");
  const [incStatus, setIncStatus] = useState("investigating");

  const fetchConfigs = async () => {
    if (!user) return;
    // We need to fetch all configs the user owns - the public SELECT policy only shows enabled ones
    // But since we also have user_id check on UPDATE/INSERT, we use that
    const { data } = await supabase.from("status_page_config").select("*").order("created_at");
    if (data) setConfigs(data as StatusPageConfig[]);
  };

  const fetchPageServices = async (pageId: string) => {
    const { data } = await supabase.from("status_page_services").select("*").eq("status_page_id", pageId).order("display_order");
    if (data) setPageServices((prev) => ({ ...prev, [pageId]: data as StatusPageService[] }));
  };

  const fetchPageIncidents = async (pageId: string) => {
    const { data } = await supabase.from("status_page_incidents").select("*").eq("status_page_id", pageId).order("started_at", { ascending: false });
    if (data) setPageIncidents((prev) => ({ ...prev, [pageId]: data as StatusPageIncident[] }));
  };

  const fetchServices = async () => {
    if (!user) return;
    const { data } = await supabase.from("services").select("id, name, status, health_score").eq("user_id", user.id);
    if (data) setServices(data as Service[]);
  };

  useEffect(() => {
    fetchConfigs();
    fetchServices();
  }, [user]);

  useEffect(() => {
    configs.forEach((c) => { fetchPageServices(c.id); fetchPageIncidents(c.id); });
  }, [configs]);

  const createConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const { error } = await supabase.from("status_page_config").insert({
      user_id: user.id, page_title: cfgTitle, page_description: cfgDesc || null,
      slug: cfgSlug.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Status page created" });
    setConfigDialogOpen(false);
    setCfgTitle("System Status"); setCfgDesc(""); setCfgSlug("");
    fetchConfigs();
  };

  const toggleEnabled = async (id: string, enabled: boolean) => {
    await supabase.from("status_page_config").update({ enabled }).eq("id", id);
    fetchConfigs();
  };

  const deleteConfig = async (id: string) => {
    await supabase.from("status_page_config").delete().eq("id", id);
    fetchConfigs();
    toast({ title: "Status page deleted" });
  };

  const addService = async (e: React.FormEvent) => {
    e.preventDefault();
    const current = pageServices[svcPageId] || [];
    const { error } = await supabase.from("status_page_services").insert({
      status_page_id: svcPageId, service_id: svcServiceId,
      display_name: svcDisplayName, display_order: current.length,
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Service added" });
    setSvcDialogOpen(false);
    setSvcServiceId(""); setSvcDisplayName("");
    fetchPageServices(svcPageId);
  };

  const removeService = async (svc: StatusPageService) => {
    await supabase.from("status_page_services").delete().eq("id", svc.id);
    fetchPageServices(svc.status_page_id);
    toast({ title: "Service removed" });
  };

  const createIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("status_page_incidents").insert({
      status_page_id: incPageId, title: incTitle, message: incMessage || null,
      severity: incSeverity, status: incStatus,
      resolved_at: incStatus === "resolved" ? new Date().toISOString() : null,
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Incident posted" });
    setIncDialogOpen(false);
    setIncTitle(""); setIncMessage(""); setIncSeverity("warning"); setIncStatus("investigating");
    fetchPageIncidents(incPageId);
  };

  const updateIncidentStatus = async (incident: StatusPageIncident, newStatus: string) => {
    await supabase.from("status_page_incidents").update({
      status: newStatus,
      resolved_at: newStatus === "resolved" ? new Date().toISOString() : null,
    }).eq("id", incident.id);
    fetchPageIncidents(incident.status_page_id);
    toast({ title: `Incident ${newStatus}` });
  };

  const deleteIncident = async (incident: StatusPageIncident) => {
    await supabase.from("status_page_incidents").delete().eq("id", incident.id);
    fetchPageIncidents(incident.status_page_id);
    toast({ title: "Incident deleted" });
  };

  const copyStatusUrl = (slug: string) => {
    const url = `${window.location.origin}/status/${slug}`;
    navigator.clipboard.writeText(url);
    toast({ title: "URL copied!" });
  };

  const severityColor: Record<string, string> = {
    info: "bg-chart-2/15 text-chart-2 border-chart-2/30",
    warning: "bg-warning/15 text-warning border-warning/30",
    critical: "bg-destructive/15 text-destructive border-destructive/30",
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Status Pages</h1>
        <p className="text-sm text-muted-foreground">Manage public-facing status pages for external stakeholders</p>
      </div>

      <div className="flex justify-end">
        <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />New Status Page</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Status Page</DialogTitle></DialogHeader>
            <form onSubmit={createConfig} className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">Page Title</Label>
                <Input value={cfgTitle} onChange={(e) => setCfgTitle(e.target.value)} required />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Description</Label>
                <Input value={cfgDesc} onChange={(e) => setCfgDesc(e.target.value)} placeholder="Current system status" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">URL Slug</Label>
                <Input value={cfgSlug} onChange={(e) => setCfgSlug(e.target.value)} placeholder="my-company" required />
                <p className="text-xs text-muted-foreground mt-1">{window.location.origin}/status/{cfgSlug || "my-company"}</p>
              </div>
              <Button type="submit" className="w-full">Create</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {configs.map((config, i) => {
        const svcs = pageServices[config.id] || [];
        const incidents = pageIncidents[config.id] || [];
        const activeIncidents = incidents.filter((inc) => inc.status !== "resolved");

        return (
          <motion.div key={config.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card>
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Globe className="h-4 w-4 text-primary" />
                    {config.page_title}
                  </CardTitle>
                  <CardDescription>{config.page_description}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={config.enabled} onCheckedChange={(v) => toggleEnabled(config.id, v)} />
                  <Button variant="outline" size="sm" onClick={() => copyStatusUrl(config.slug)}>
                    <Copy className="mr-1 h-3 w-3" />Copy URL
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <a href={`/status/${config.slug}`} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-1 h-3 w-3" />View
                    </a>
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteConfig(config.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="services">
                  <TabsList className="h-8">
                    <TabsTrigger value="services" className="text-xs">Services ({svcs.length})</TabsTrigger>
                    <TabsTrigger value="incidents" className="text-xs">Incidents ({activeIncidents.length} active)</TabsTrigger>
                  </TabsList>

                  <TabsContent value="services" className="mt-3 space-y-2">
                    <div className="flex justify-end">
                      <Button variant="outline" size="sm" onClick={() => { setSvcPageId(config.id); setSvcDialogOpen(true); }}>
                        <Plus className="mr-1 h-3 w-3" />Add Service
                      </Button>
                    </div>
                    {svcs.map((svc) => {
                      const realService = services.find((s) => s.id === svc.service_id);
                      return (
                        <div key={svc.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                          <div className="flex items-center gap-3">
                            <div className={`h-2.5 w-2.5 rounded-full ${realService?.status === "healthy" ? "bg-success" : realService?.status === "degraded" ? "bg-warning" : "bg-destructive"}`} />
                            <span className="text-sm font-medium">{svc.display_name}</span>
                            <span className="text-xs text-muted-foreground capitalize">{realService?.status || "unknown"}</span>
                          </div>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeService(svc)}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      );
                    })}
                  </TabsContent>

                  <TabsContent value="incidents" className="mt-3 space-y-2">
                    <div className="flex justify-end">
                      <Button variant="outline" size="sm" onClick={() => { setIncPageId(config.id); setIncDialogOpen(true); }}>
                        <Plus className="mr-1 h-3 w-3" />Post Incident
                      </Button>
                    </div>
                    {incidents.map((inc) => (
                      <div key={inc.id} className="rounded-lg border border-border p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-warning" />
                            <span className="text-sm font-medium">{inc.title}</span>
                            <Badge variant="outline" className={severityColor[inc.severity]}>{inc.severity}</Badge>
                            <Badge variant="outline" className="capitalize">{inc.status}</Badge>
                          </div>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteIncident(inc)}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                        {inc.message && <p className="text-xs text-muted-foreground">{inc.message}</p>}
                        {inc.status !== "resolved" && (
                          <div className="flex gap-1">
                            {incidentStatuses.filter((s) => s !== inc.status).map((s) => (
                              <Button key={s} variant="outline" size="sm" className="text-xs h-7" onClick={() => updateIncidentStatus(inc, s)}>
                                {s}
                              </Button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}

      {configs.length === 0 && (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center py-12 text-center">
            <Globe className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="text-lg font-semibold">No status pages</h3>
            <p className="mt-1 text-sm text-muted-foreground">Create a public status page for your stakeholders.</p>
          </CardContent>
        </Card>
      )}

      {/* Add service dialog */}
      <Dialog open={svcDialogOpen} onOpenChange={setSvcDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Service to Status Page</DialogTitle></DialogHeader>
          <form onSubmit={addService} className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Service</Label>
              <Select value={svcServiceId} onValueChange={(v) => { setSvcServiceId(v); const svc = services.find((s) => s.id === v); if (svc) setSvcDisplayName(svc.name); }}>
                <SelectTrigger><SelectValue placeholder="Select service..." /></SelectTrigger>
                <SelectContent>
                  {services.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Display Name</Label>
              <Input value={svcDisplayName} onChange={(e) => setSvcDisplayName(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full">Add Service</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Post incident dialog */}
      <Dialog open={incDialogOpen} onOpenChange={setIncDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Post Incident Update</DialogTitle></DialogHeader>
          <form onSubmit={createIncident} className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Title</Label>
              <Input value={incTitle} onChange={(e) => setIncTitle(e.target.value)} placeholder="e.g. API Latency Issues" required />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Message</Label>
              <Textarea value={incMessage} onChange={(e) => setIncMessage(e.target.value)} placeholder="We are currently investigating..." rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Severity</Label>
                <Select value={incSeverity} onValueChange={setIncSeverity}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {severityOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select value={incStatus} onValueChange={setIncStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {incidentStatuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="submit" className="w-full">Post Incident</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
