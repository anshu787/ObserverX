import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Moon, Sun, User, Webhook, Plus, Trash2, TestTube, RefreshCw, CheckCircle, XCircle, ScrollText, Key, Copy, ShieldAlert, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { formatDistanceToNow, format } from "date-fns";

interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  events: string[];
  secret: string | null;
  created_at: string;
}

const eventOptions = [
  { value: "alert", label: "Alerts" },
  { value: "prediction", label: "Predictions" },
  { value: "incident", label: "Incidents" },
  { value: "escalation", label: "Escalations" },
];

interface DeliveryLog {
  id: string;
  webhook_id: string;
  event_type: string;
  status_code: number | null;
  success: boolean;
  error_message: string | null;
  attempt: number;
  created_at: string;
  payload: any;
}

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [events, setEvents] = useState<string[]>(["alert", "prediction", "incident", "escalation"]);
  const [testing, setTesting] = useState<string | null>(null);
  const [deliveryLogs, setDeliveryLogs] = useState<DeliveryLog[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [retrying, setRetrying] = useState<string | null>(null);

  // API key state
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState(false);
  const [apiKeyName, setApiKeyName] = useState("");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [generatingKey, setGeneratingKey] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null);

  const fetchApiKeys = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("api_keys")
      .select("*")
      .eq("user_id", user.id)
      .is("revoked_at", null)
      .order("created_at", { ascending: false });
    if (data) setApiKeys(data as ApiKey[]);
  };

  const generateApiKey = async () => {
    if (!apiKeyName.trim()) return;
    setGeneratingKey(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-api-keys", {
        body: { action: "generate", name: apiKeyName },
      });
      if (error) throw error;
      setGeneratedKey(data.key);
      fetchApiKeys();
      toast({ title: "API key generated" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setGeneratingKey(false);
    }
  };

  const revokeApiKey = async (key: ApiKey) => {
    try {
      const { error } = await supabase.functions.invoke("manage-api-keys", {
        body: { action: "revoke", key_id: key.id },
      });
      if (error) throw error;
      toast({ title: "API key revoked" });
      setRevokeTarget(null);
      fetchApiKeys();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const fetchWebhooks = async () => {
    if (!user) return;
    const { data } = await supabase.from("webhook_configs").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    if (data) setWebhooks(data as WebhookConfig[]);
  };

  useEffect(() => { fetchWebhooks(); fetchDeliveryLogs(); fetchApiKeys(); }, [user]);

  const fetchDeliveryLogs = async () => {
    if (!user) return;
    const { data } = await (supabase as any)
      .from("webhook_delivery_logs")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setDeliveryLogs(data as DeliveryLog[]);
  };

  const retryDelivery = async (log: DeliveryLog) => {
    setRetrying(log.id);
    try {
      const { data, error } = await supabase.functions.invoke("send-webhook", {
        body: {
          user_id: user!.id,
          event_type: log.event_type,
          title: log.payload?.title || "Retry",
          message: log.payload?.message || "",
          severity: log.payload?.severity || "info",
          metadata: log.payload?.metadata || {},
          retry_delivery_id: log.id,
        },
      });
      if (error) throw error;
      toast({ title: data?.delivered > 0 ? "Retry successful!" : "Retry failed", variant: data?.delivered > 0 ? "default" : "destructive" });
      fetchDeliveryLogs();
    } catch (err: any) {
      toast({ title: "Retry failed", description: err.message, variant: "destructive" });
    } finally {
      setRetrying(null);
    }
  };

  const createWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const { data: inserted, error } = await supabase.from("webhook_configs").insert({
      user_id: user.id,
      name,
      url,
      secret: secret || null,
      events,
    }).select("id").single();
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      await (supabase as any).from("audit_log").insert({
        user_id: user.id, action: "webhook_created", resource_type: "webhook",
        resource_id: inserted?.id, details: { name, url, events },
      });
      toast({ title: "Webhook created" });
      setDialogOpen(false);
      setName(""); setUrl(""); setSecret(""); setEvents(["alert", "prediction", "incident", "escalation"]);
      fetchWebhooks();
    }
  };

  const toggleWebhook = async (id: string, enabled: boolean) => {
    await supabase.from("webhook_configs").update({ enabled }).eq("id", id);
    fetchWebhooks();
  };

  const deleteWebhook = async (id: string) => {
    const wh = webhooks.find(w => w.id === id);
    await supabase.from("webhook_configs").delete().eq("id", id);
    if (user) {
      await (supabase as any).from("audit_log").insert({
        user_id: user.id, action: "webhook_deleted", resource_type: "webhook",
        resource_id: id, details: { name: wh?.name, url: wh?.url },
      });
    }
    fetchWebhooks();
    toast({ title: "Webhook deleted" });
  };

  const testWebhook = async (wh: WebhookConfig) => {
    if (!user) return;
    setTesting(wh.id);
    try {
      const { data, error } = await supabase.functions.invoke("send-webhook", {
        body: {
          user_id: user.id,
          event_type: "alert",
          title: "Test notification from ObserveX",
          message: "This is a test webhook delivery. If you received this, your webhook is configured correctly!",
          severity: "info",
          metadata: { test: true },
        },
      });
      if (error) throw error;
      toast({
        title: data?.delivered > 0 ? "Test delivered!" : "No delivery",
        description: data?.delivered > 0 ? `Delivered to ${data.delivered}/${data.total} endpoint(s)` : "Webhook may be disabled or URL unreachable.",
        variant: data?.delivered > 0 ? "default" : "destructive",
      });
    } catch (err: any) {
      toast({ title: "Test failed", description: err.message, variant: "destructive" });
    } finally {
      setTesting(null);
    }
  };

  const toggleEvent = (event: string) => {
    setEvents((prev) => prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]);
  };

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your preferences and integrations</p>
      </div>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" />Account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm text-muted-foreground">Email</Label>
            <span className="text-sm font-mono">{user?.email}</span>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            Appearance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <Label>Dark Mode</Label>
            <Switch checked={theme === "dark"} onCheckedChange={toggleTheme} />
          </div>
        </CardContent>
      </Card>

      {/* Webhook Configuration */}
      <Card className="border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Webhook className="h-4 w-4" />Webhook Notifications
            </CardTitle>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="mr-1 h-3 w-3" />Add Webhook</Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Add Webhook Endpoint</DialogTitle></DialogHeader>
                <form onSubmit={createWebhook} className="space-y-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Name</Label>
                    <Input placeholder="e.g. Slack, Discord, PagerDuty" value={name} onChange={(e) => setName(e.target.value)} required />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">URL</Label>
                    <Input placeholder="https://hooks.slack.com/..." value={url} onChange={(e) => setUrl(e.target.value)} type="url" required />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Secret (optional, for HMAC signing)</Label>
                    <Input placeholder="Optional signing secret" value={secret} onChange={(e) => setSecret(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">Events</Label>
                    <div className="flex gap-4">
                      {eventOptions.map((opt) => (
                        <label key={opt.value} className="flex items-center gap-2 text-sm">
                          <Checkbox checked={events.includes(opt.value)} onCheckedChange={() => toggleEvent(opt.value)} />
                          {opt.label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <Button type="submit" className="w-full">Create Webhook</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">Receive alerts, predictions, and incident notifications via webhooks to Slack, Discord, PagerDuty, or any HTTP endpoint.</p>
          {webhooks.map((wh, i) => (
            <motion.div key={wh.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="flex items-center gap-3">
                  <Switch checked={wh.enabled} onCheckedChange={(v) => toggleWebhook(wh.id, v)} />
                  <div>
                    <p className="text-sm font-medium">{wh.name}</p>
                    <p className="text-xs text-muted-foreground font-mono truncate max-w-[200px]">{wh.url}</p>
                    <div className="flex gap-1 mt-1">
                      {wh.events.map((ev) => (
                        <Badge key={ev} variant="outline" className="text-[10px] px-1.5 py-0">{ev}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => testWebhook(wh)} disabled={testing === wh.id}>
                    <TestTube className={`h-4 w-4 ${testing === wh.id ? "animate-spin" : ""}`} />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteWebhook(wh.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
          {webhooks.length === 0 && (
            <div className="text-center py-6 text-sm text-muted-foreground">
              No webhooks configured. Add one to receive external notifications.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delivery Logs */}
      <Card className="border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <ScrollText className="h-4 w-4" />Delivery Log
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={fetchDeliveryLogs}>
                <RefreshCw className="mr-1 h-3 w-3" />Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowLogs(!showLogs)}>
                {showLogs ? "Hide" : "Show"} Logs
              </Button>
            </div>
          </div>
        </CardHeader>
        {showLogs && (
          <CardContent className="space-y-2">
            {deliveryLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No delivery attempts yet.</p>
            ) : (
              deliveryLogs.map((log) => {
                const webhook = webhooks.find((w) => w.id === log.webhook_id);
                return (
                  <div key={log.id} className="flex items-center justify-between rounded-lg border border-border/50 p-3 text-sm">
                    <div className="flex items-center gap-3">
                      {log.success ? (
                        <CheckCircle className="h-4 w-4 text-chart-2 shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive shrink-0" />
                      )}
                      <div>
                        <p className="font-medium">{webhook?.name || "Deleted webhook"}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{log.event_type}</Badge>
                          {log.status_code && <span className="text-[10px] text-muted-foreground font-mono">HTTP {log.status_code}</span>}
                          {log.attempt > 1 && <Badge variant="outline" className="text-[10px] px-1.5 py-0">Attempt {log.attempt}</Badge>}
                          <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}</span>
                        </div>
                        {log.error_message && <p className="text-xs text-destructive mt-0.5">{log.error_message}</p>}
                      </div>
                    </div>
                    {!log.success && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => retryDelivery(log)}
                        disabled={retrying === log.id}
                      >
                        <RefreshCw className={`mr-1 h-3 w-3 ${retrying === log.id ? "animate-spin" : ""}`} />
                        Retry
                      </Button>
                    )}
                  </div>
                );
              })
            )}
          </CardContent>
        )}
      </Card>

      {/* API Key Management */}
      <Card className="border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Key className="h-4 w-4" />API Keys
              </CardTitle>
              <CardDescription className="mt-1">Generate API keys for server integrations and external tools.</CardDescription>
            </div>
            <Dialog open={apiKeyDialogOpen} onOpenChange={(open) => {
              setApiKeyDialogOpen(open);
              if (!open) { setGeneratedKey(null); setApiKeyName(""); }
            }}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="mr-1 h-3 w-3" />New Key</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{generatedKey ? "API Key Generated" : "Generate API Key"}</DialogTitle>
                  <DialogDescription>
                    {generatedKey
                      ? "Copy this key now — it won't be shown again."
                      : "Create a new API key for external integrations."}
                  </DialogDescription>
                </DialogHeader>
                {generatedKey ? (
                  <div className="space-y-4">
                    <div className="rounded-lg border border-warning/30 bg-warning/5 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <ShieldAlert className="h-4 w-4 text-warning" />
                        <span className="text-sm font-medium text-warning">Store this key securely</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-xs font-mono bg-muted p-2 rounded break-all">{generatedKey}</code>
                        <Button variant="outline" size="icon" className="shrink-0" onClick={() => {
                          navigator.clipboard.writeText(generatedKey);
                          toast({ title: "Copied to clipboard" });
                        }}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <Button className="w-full" onClick={() => { setApiKeyDialogOpen(false); setGeneratedKey(null); setApiKeyName(""); }}>
                      Done
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Key Name</Label>
                      <Input placeholder="e.g. CI/CD Pipeline, Monitoring Agent" value={apiKeyName} onChange={(e) => setApiKeyName(e.target.value)} />
                    </div>
                    <Button className="w-full" onClick={generateApiKey} disabled={!apiKeyName.trim() || generatingKey}>
                      {generatingKey ? <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Key className="mr-2 h-3.5 w-3.5" />}
                      Generate Key
                    </Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {apiKeys.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground">
              No API keys. Generate one to integrate with external tools.
            </div>
          ) : (
            apiKeys.map((key, i) => (
              <motion.div key={key.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <p className="text-sm font-medium">{key.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <code className="text-xs font-mono text-muted-foreground">{key.key_prefix}</code>
                      <span className="text-[10px] text-muted-foreground">
                        Created {format(new Date(key.created_at), "MMM d, yyyy")}
                      </span>
                      {key.last_used_at && (
                        <span className="text-[10px] text-muted-foreground">
                          · Last used {formatDistanceToNow(new Date(key.last_used_at), { addSuffix: true })}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setRevokeTarget(key)}>
                    <Trash2 className="mr-1 h-3.5 w-3.5" />Revoke
                  </Button>
                </div>
              </motion.div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Revoke API key confirmation */}
      <AlertDialog open={!!revokeTarget} onOpenChange={(open) => { if (!open) setRevokeTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke API Key</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke "{revokeTarget?.name}"? Any integrations using this key will stop working immediately. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => revokeTarget && revokeApiKey(revokeTarget)}
            >
              Revoke Key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
