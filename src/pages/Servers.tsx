import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Server, Copy, Trash2 } from "lucide-react";
import { motion } from "framer-motion";

interface ServerRow {
  id: string;
  name: string;
  hostname: string;
  ip_address: string | null;
  status: string;
  health_score: number;
  api_key: string;
  created_at: string;
}

const statusColor: Record<string, string> = {
  healthy: "bg-success",
  degraded: "bg-warning",
  critical: "bg-destructive",
  offline: "bg-muted-foreground",
};

export default function Servers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [servers, setServers] = useState<ServerRow[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [hostname, setHostname] = useState("");
  const [ip, setIp] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchServers = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("servers")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (data) setServers(data as ServerRow[]);
  };

  useEffect(() => { fetchServers(); }, [user]);

  const addServer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    const { error } = await supabase.from("servers").insert({ user_id: user.id, name, hostname, ip_address: ip || null });
    setLoading(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Server added" });
      setOpen(false);
      setName("");
      setHostname("");
      setIp("");
      fetchServers();
    }
  };

  const deleteServer = async (id: string) => {
    const { error } = await supabase.from("servers").delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else fetchServers();
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast({ title: "API key copied" });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Servers</h1>
          <p className="text-sm text-muted-foreground">Manage monitored infrastructure</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Add Server</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Server</DialogTitle></DialogHeader>
            <form onSubmit={addServer} className="space-y-4">
              <Input placeholder="Server name" value={name} onChange={(e) => setName(e.target.value)} required />
              <Input placeholder="Hostname (e.g. prod-api-01)" value={hostname} onChange={(e) => setHostname(e.target.value)} required />
              <Input placeholder="IP address (optional)" value={ip} onChange={(e) => setIp(e.target.value)} />
              <Button type="submit" className="w-full" disabled={loading}>{loading ? "Adding..." : "Add Server"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {servers.map((server, i) => (
          <motion.div key={server.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="border-border/50">
              <CardHeader className="flex flex-row items-start justify-between pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                    <Server className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{server.name}</CardTitle>
                    <p className="text-xs text-muted-foreground font-mono">{server.hostname}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className={`h-2.5 w-2.5 rounded-full ${statusColor[server.status] ?? "bg-muted-foreground"}`} />
                  <span className="text-xs capitalize text-muted-foreground">{server.status}</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Health</span>
                  <span className="font-mono font-medium">{server.health_score}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className={`h-full rounded-full transition-all ${server.health_score > 80 ? "bg-success" : server.health_score > 50 ? "bg-warning" : "bg-destructive"}`}
                    style={{ width: `${server.health_score}%` }}
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => copyKey(server.api_key)}>
                    <Copy className="mr-1 h-3 w-3" />API Key
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => deleteServer(server.id)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {servers.length === 0 && (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center py-12 text-center">
            <Server className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="text-lg font-semibold">No servers yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">Add a server to start monitoring its health.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
