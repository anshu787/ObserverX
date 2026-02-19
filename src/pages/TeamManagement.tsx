import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Users, Shield, UserPlus, Crown, Eye, Trash2, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

interface TeamMember {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  role: string;
  role_id: string;
}

export default function TeamManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("viewer");
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchTeam();
  }, [user]);

  const fetchTeam = async () => {
    if (!user) return;
    setLoading(true);

    // Check if current user is admin
    const { data: myRoles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const adminStatus = myRoles?.some((r: any) => r.role === "admin") || false;
    setIsAdmin(adminStatus);

    // Fetch all profiles with their roles
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name, avatar_url, created_at");

    const { data: roles } = await supabase
      .from("user_roles")
      .select("id, user_id, role");

    if (profiles && roles) {
      const memberList: TeamMember[] = profiles.map((p: any) => {
        const userRole = roles.find((r: any) => r.user_id === p.user_id);
        return {
          user_id: p.user_id,
          display_name: p.display_name,
          avatar_url: p.avatar_url,
          created_at: p.created_at,
          role: userRole?.role || "viewer",
          role_id: userRole?.id || "",
        };
      });
      setMembers(memberList.sort((a, b) => {
        if (a.role === "admin" && b.role !== "admin") return -1;
        if (a.role !== "admin" && b.role === "admin") return 1;
        return 0;
      }));
    }
    setLoading(false);
  };

  const updateRole = async (member: TeamMember, newRole: string) => {
    if (!isAdmin || member.user_id === user?.id) return;
    setUpdating(member.user_id);
    try {
      const { error } = await supabase
        .from("user_roles")
        .update({ role: newRole as "admin" | "viewer" })
        .eq("user_id", member.user_id);
      if (error) throw error;
      // Audit log
      await (supabase as any).from("audit_log").insert({
        user_id: user!.id,
        action: "role_changed",
        resource_type: "user_role",
        resource_id: member.user_id,
        details: { target_name: member.display_name, old_role: member.role, new_role: newRole },
      });
      toast({ title: "Role updated", description: `${member.display_name || "User"} is now ${newRole}` });
      fetchTeam();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setUpdating(null);
    }
  };

  const removeUser = async (member: TeamMember) => {
    if (!isAdmin || member.user_id === user?.id) return;
    setUpdating(member.user_id);
    try {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", member.user_id);
      if (error) throw error;
      await (supabase as any).from("audit_log").insert({
        user_id: user!.id,
        action: "user_removed",
        resource_type: "user_role",
        resource_id: member.user_id,
        details: { target_name: member.display_name, role: member.role },
      });
      toast({ title: "User removed from team" });
      fetchTeam();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setUpdating(null);
    }
  };

  const roleIcon = (role: string) => {
    if (role === "admin") return <Crown className="h-3.5 w-3.5" />;
    return <Eye className="h-3.5 w-3.5" />;
  };

  const roleBadgeStyle = (role: string) => {
    if (role === "admin") return "bg-primary/15 text-primary border-primary/30";
    return "bg-muted text-muted-foreground border-border";
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Team Management</h1>
          <p className="text-sm text-muted-foreground">Manage users, roles, and access control</p>
        </div>
        {!isAdmin && (
          <Badge variant="outline" className="text-xs bg-warning/15 text-warning border-warning/30">
            <Eye className="mr-1 h-3 w-3" />Viewer Access
          </Badge>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Team Members", value: members.length, icon: Users, color: "text-primary" },
          { label: "Admins", value: members.filter((m) => m.role === "admin").length, icon: Crown, color: "text-chart-2" },
          { label: "Viewers", value: members.filter((m) => m.role === "viewer").length, icon: Eye, color: "text-muted-foreground" },
        ].map(({ label, value, icon: Icon, color }, i) => (
          <motion.div key={label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="border-border/50">
              <CardContent className="flex items-center gap-3 p-4">
                <Icon className={`h-5 w-5 ${color}`} />
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-xl font-bold font-mono">{value}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Team Table */}
      <Card className="border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4" />Team Members
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member, i) => {
                  const isMe = member.user_id === user?.id;
                  return (
                    <motion.tr
                      key={member.user_id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className="border-b border-border/50"
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-sm font-medium">
                            {(member.display_name || "?")[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium">
                              {member.display_name || "Unknown"}
                              {isMe && <span className="text-xs text-muted-foreground ml-1">(you)</span>}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {isAdmin && !isMe ? (
                          <Select
                            value={member.role}
                            onValueChange={(v) => updateRole(member, v)}
                            disabled={updating === member.user_id}
                          >
                            <SelectTrigger className="w-[110px] h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="viewer">Viewer</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant="outline" className={`text-xs ${roleBadgeStyle(member.role)}`}>
                            {roleIcon(member.role)}
                            <span className="ml-1">{member.role}</span>
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(member.created_at), { addSuffix: true })}
                        </span>
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          {!isMe && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => removeUser(member)}
                              disabled={updating === member.user_id}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </motion.tr>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {!loading && members.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No team members found.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Access Control Info */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Access Control Reference</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-2 mb-2">
                <Crown className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Admin</span>
              </div>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Full read/write access to all data</li>
                <li>• Manage team members and roles</li>
                <li>• Configure webhooks and alert rules</li>
                <li>• Create and resolve incidents</li>
              </ul>
            </div>
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-2 mb-2">
                <Eye className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Viewer</span>
              </div>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• View dashboards, metrics, and logs</li>
                <li>• View incidents and alerts</li>
                <li>• Cannot modify configurations</li>
                <li>• Cannot manage team members</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
