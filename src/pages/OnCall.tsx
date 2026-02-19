import { useEffect, useState, useMemo, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Phone, Plus, Trash2, Users, Shield, ArrowUp, ArrowDown, Clock, UserCheck, CalendarDays, ChevronLeft, ChevronRight, RefreshCw, History, CalendarRange, Download, ArrowUpDown, ArrowUpNarrowWide, ArrowDownNarrowWide, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { format, addDays, startOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isSameDay } from "date-fns";

interface Schedule {
  id: string;
  name: string;
  timezone: string;
  rotation_interval_days: number;
  current_index: number;
  last_rotated_at: string;
  created_at: string;
}

interface Member {
  id: string;
  schedule_id: string;
  member_name: string;
  member_email: string | null;
  position: number;
}

interface EscalationPolicy {
  id: string;
  name: string;
  description: string | null;
  repeat_count: number;
}

interface EscalationLevel {
  id: string;
  policy_id: string;
  level_order: number;
  schedule_id: string | null;
  notify_method: string;
  timeout_minutes: number;
  contact_name: string | null;
  contact_email: string | null;
}

interface Override {
  id: string;
  schedule_id: string;
  override_date: string;
  member_id: string;
  reason: string | null;
  created_at: string;
}

const notifyMethods = [
  { value: "in_app", label: "In-App Notification" },
  { value: "email", label: "Email" },
  { value: "webhook", label: "Webhook" },
  { value: "sms", label: "SMS" },
];

export default function OnCall() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [members, setMembers] = useState<Record<string, Member[]>>({});
  const [policies, setPolicies] = useState<EscalationPolicy[]>([]);
  const [levels, setLevels] = useState<Record<string, EscalationLevel[]>>({});

  // Calendar state
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [calendarView, setCalendarView] = useState<"week" | "month">("month");
  const [calendarScheduleId, setCalendarScheduleId] = useState<string>("");
  const [overrides, setOverrides] = useState<Override[]>([]);

  // Override dialog
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [overrideDate, setOverrideDate] = useState<Date | null>(null);
  const [overrideMemberId, setOverrideMemberId] = useState("");
  const [overrideReason, setOverrideReason] = useState("");

  // Bulk override dialog
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkStartDate, setBulkStartDate] = useState("");
  const [bulkEndDate, setBulkEndDate] = useState("");
  const [bulkMemberId, setBulkMemberId] = useState("");
  const [bulkReason, setBulkReason] = useState("");

  // Override log filter
  const [logFilterStart, setLogFilterStart] = useState("");
  const [logFilterEnd, setLogFilterEnd] = useState("");
  const [logFilterMember, setLogFilterMember] = useState("all");
  const [logFilterReason, setLogFilterReason] = useState("");
  const [logPage, setLogPage] = useState(0);
  const [logSortField, setLogSortField] = useState<"created_at" | "override_date" | "member_name">("created_at");
  const [logSortDir, setLogSortDir] = useState<"asc" | "desc">("desc");
  const LOG_PAGE_SIZE = 20;
  const [deleteOverrideId, setDeleteOverrideId] = useState<string | null>(null);

  // Edit override dialog
  const [editOverride, setEditOverride] = useState<Override | null>(null);
  const [editMemberId, setEditMemberId] = useState("");
  const [editReason, setEditReason] = useState("");

  // Schedule dialog
  const [schedDialogOpen, setSchedDialogOpen] = useState(false);
  const [schedName, setSchedName] = useState("");
  const [schedTimezone, setSchedTimezone] = useState("UTC");
  const [schedInterval, setSchedInterval] = useState(1);

  // Member dialog
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [memberScheduleId, setMemberScheduleId] = useState("");
  const [memberName, setMemberName] = useState("");
  const [memberEmail, setMemberEmail] = useState("");

  // Policy dialog
  const [policyDialogOpen, setPolicyDialogOpen] = useState(false);
  const [policyName, setPolicyName] = useState("");
  const [policyDesc, setPolicyDesc] = useState("");
  const [policyRepeat, setPolicyRepeat] = useState(0);

  // Level dialog
  const [levelDialogOpen, setLevelDialogOpen] = useState(false);
  const [levelPolicyId, setLevelPolicyId] = useState("");
  const [levelNotify, setLevelNotify] = useState("in_app");
  const [levelTimeout, setLevelTimeout] = useState(15);
  const [levelScheduleId, setLevelScheduleId] = useState<string>("");
  const [levelContactName, setLevelContactName] = useState("");
  const [levelContactEmail, setLevelContactEmail] = useState("");

  const fetchSchedules = async () => {
    if (!user) return;
    const { data } = await supabase.from("oncall_schedules").select("*").eq("user_id", user.id).order("created_at");
    if (data) setSchedules(data as Schedule[]);
  };

  const fetchMembers = async (scheduleId: string) => {
    const { data } = await supabase.from("oncall_members").select("*").eq("schedule_id", scheduleId).order("position");
    if (data) setMembers((prev) => ({ ...prev, [scheduleId]: data as Member[] }));
  };

  const fetchPolicies = async () => {
    if (!user) return;
    const { data } = await supabase.from("escalation_policies").select("*").eq("user_id", user.id).order("created_at");
    if (data) setPolicies(data as EscalationPolicy[]);
  };

  const fetchLevels = async (policyId: string) => {
    const { data } = await supabase.from("escalation_levels").select("*").eq("policy_id", policyId).order("level_order");
    if (data) setLevels((prev) => ({ ...prev, [policyId]: data as EscalationLevel[] }));
  };

  const fetchOverrides = async (scheduleId: string) => {
    if (!user) return;
    const { data } = await supabase
      .from("oncall_overrides")
      .select("*")
      .eq("schedule_id", scheduleId)
      .eq("user_id", user.id);
    if (data) setOverrides(data as Override[]);
  };

  useEffect(() => {
    fetchSchedules();
    fetchPolicies();
  }, [user]);

  useEffect(() => {
    schedules.forEach((s) => fetchMembers(s.id));
  }, [schedules]);

  useEffect(() => {
    policies.forEach((p) => fetchLevels(p.id));
  }, [policies]);

  useEffect(() => {
    if (calendarScheduleId) fetchOverrides(calendarScheduleId);
  }, [calendarScheduleId]);

  const createSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const { error } = await supabase.from("oncall_schedules").insert({
      user_id: user.id, name: schedName, timezone: schedTimezone, rotation_interval_days: schedInterval,
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Schedule created" });
    setSchedDialogOpen(false);
    setSchedName(""); setSchedTimezone("UTC"); setSchedInterval(1);
    fetchSchedules();
  };

  const deleteSchedule = async (id: string) => {
    await supabase.from("oncall_schedules").delete().eq("id", id);
    fetchSchedules();
    toast({ title: "Schedule deleted" });
  };

  const addMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const currentMembers = members[memberScheduleId] || [];
    const { error } = await supabase.from("oncall_members").insert({
      schedule_id: memberScheduleId, user_id: user.id, member_name: memberName,
      member_email: memberEmail || null, position: currentMembers.length,
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Member added" });
    setMemberDialogOpen(false);
    setMemberName(""); setMemberEmail("");
    fetchMembers(memberScheduleId);
  };

  const removeMember = async (member: Member) => {
    await supabase.from("oncall_members").delete().eq("id", member.id);
    fetchMembers(member.schedule_id);
    toast({ title: "Member removed" });
  };

  const moveMember = async (member: Member, direction: "up" | "down") => {
    const schedMembers = members[member.schedule_id] || [];
    const idx = schedMembers.findIndex((m) => m.id === member.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= schedMembers.length) return;
    const swap = schedMembers[swapIdx];
    await Promise.all([
      supabase.from("oncall_members").update({ position: swap.position }).eq("id", member.id),
      supabase.from("oncall_members").update({ position: member.position }).eq("id", swap.id),
    ]);
    fetchMembers(member.schedule_id);
  };

  const createPolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const { error } = await supabase.from("escalation_policies").insert({
      user_id: user.id, name: policyName, description: policyDesc || null, repeat_count: policyRepeat,
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Policy created" });
    setPolicyDialogOpen(false);
    setPolicyName(""); setPolicyDesc(""); setPolicyRepeat(0);
    fetchPolicies();
  };

  const deletePolicy = async (id: string) => {
    await supabase.from("escalation_policies").delete().eq("id", id);
    fetchPolicies();
    toast({ title: "Policy deleted" });
  };

  const addLevel = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentLevels = levels[levelPolicyId] || [];
    const { error } = await supabase.from("escalation_levels").insert({
      policy_id: levelPolicyId, level_order: currentLevels.length,
      schedule_id: levelScheduleId || null, notify_method: levelNotify,
      timeout_minutes: levelTimeout, contact_name: levelContactName || null,
      contact_email: levelContactEmail || null,
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Level added" });
    setLevelDialogOpen(false);
    setLevelNotify("in_app"); setLevelTimeout(15); setLevelScheduleId(""); setLevelContactName(""); setLevelContactEmail("");
    fetchLevels(levelPolicyId);
  };

  const removeLevel = async (level: EscalationLevel) => {
    await supabase.from("escalation_levels").delete().eq("id", level.id);
    fetchLevels(level.policy_id);
    toast({ title: "Level removed" });
  };

  const getCurrentOnCall = (schedule: Schedule): Member | null => {
    const m = members[schedule.id] || [];
    if (!m.length) return null;
    return m[schedule.current_index % m.length] || m[0];
  };

  const addOverride = async () => {
    if (!user || !overrideDate || !overrideMemberId || !calendarScheduleId) return;
    const dateStr = format(overrideDate, "yyyy-MM-dd");
    // Upsert: delete existing then insert
    await supabase.from("oncall_overrides").delete()
      .eq("schedule_id", calendarScheduleId)
      .eq("override_date", dateStr);
    const { error } = await supabase.from("oncall_overrides").insert({
      schedule_id: calendarScheduleId,
      override_date: dateStr,
      member_id: overrideMemberId,
      user_id: user.id,
      reason: overrideReason || null,
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Override added" });
    setOverrideDialogOpen(false);
    setOverrideMemberId(""); setOverrideReason("");
    fetchOverrides(calendarScheduleId);
  };

  const removeOverride = async (overrideId: string) => {
    await supabase.from("oncall_overrides").delete().eq("id", overrideId);
    toast({ title: "Override removed" });
    fetchOverrides(calendarScheduleId);
  };

  const updateOverride = async () => {
    if (!editOverride || !editMemberId) return;
    const { error } = await supabase.from("oncall_overrides").update({
      member_id: editMemberId,
      reason: editReason || null,
    }).eq("id", editOverride.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Override updated" });
    setEditOverride(null);
    fetchOverrides(calendarScheduleId);
  };

  const addBulkOverrides = async () => {
    if (!user || !bulkStartDate || !bulkEndDate || !bulkMemberId || !calendarScheduleId) return;
    const start = new Date(bulkStartDate);
    const end = new Date(bulkEndDate);
    if (end < start) { toast({ title: "Error", description: "End date must be after start date", variant: "destructive" }); return; }
    const days = eachDayOfInterval({ start, end });
    // Delete existing overrides in range, then insert all
    for (const day of days) {
      const dateStr = format(day, "yyyy-MM-dd");
      await supabase.from("oncall_overrides").delete()
        .eq("schedule_id", calendarScheduleId)
        .eq("override_date", dateStr);
    }
    const inserts = days.map((day) => ({
      schedule_id: calendarScheduleId,
      override_date: format(day, "yyyy-MM-dd"),
      member_id: bulkMemberId,
      user_id: user.id,
      reason: bulkReason || null,
    }));
    const { error } = await supabase.from("oncall_overrides").insert(inserts);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: `${days.length} override(s) added` });
    setBulkDialogOpen(false);
    setBulkStartDate(""); setBulkEndDate(""); setBulkMemberId(""); setBulkReason("");
    fetchOverrides(calendarScheduleId);
  };

  const openOverrideDialog = (day: Date) => {
    setOverrideDate(day);
    setOverrideMemberId("");
    setOverrideReason("");
    setOverrideDialogOpen(true);
  };

  // Sorted & filtered overrides for audit log (newest first)
  const sortedOverrides = useMemo(() => {
    let filtered = [...overrides];
    if (logFilterStart) {
      filtered = filtered.filter((o) => o.override_date >= logFilterStart);
    }
    if (logFilterEnd) {
      filtered = filtered.filter((o) => o.override_date <= logFilterEnd);
    }
    if (logFilterMember && logFilterMember !== "all") {
      filtered = filtered.filter((o) => o.member_id === logFilterMember);
    }
    if (logFilterReason) {
      const q = logFilterReason.toLowerCase();
      filtered = filtered.filter((o) => o.reason?.toLowerCase().includes(q));
    }
    const schedMembers = members[calendarScheduleId] || [];
    const dir = logSortDir === "asc" ? 1 : -1;
    return filtered.sort((a, b) => {
      if (logSortField === "created_at") {
        return dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      }
      if (logSortField === "override_date") {
        return dir * a.override_date.localeCompare(b.override_date);
      }
      // member_name
      const nameA = (schedMembers.find((m) => m.id === a.member_id)?.member_name || "").toLowerCase();
      const nameB = (schedMembers.find((m) => m.id === b.member_id)?.member_name || "").toLowerCase();
      return dir * nameA.localeCompare(nameB);
    });
  }, [overrides, logFilterStart, logFilterEnd, logFilterMember, logFilterReason, logSortField, logSortDir, members, calendarScheduleId]);

  // Auto-select first schedule for calendar
  useEffect(() => {
    if (schedules.length > 0 && !calendarScheduleId) {
      setCalendarScheduleId(schedules[0].id);
    }
  }, [schedules, calendarScheduleId]);

  // Generate calendar data: who is on-call each day
  const calendarData = useMemo(() => {
    const schedule = schedules.find((s) => s.id === calendarScheduleId);
    if (!schedule) return [];
    const schedMembers = members[schedule.id] || [];
    if (!schedMembers.length) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let startDate: Date;
    let endDate: Date;
    if (calendarView === "week") {
      startDate = startOfWeek(calendarMonth, { weekStartsOn: 1 });
      endDate = addDays(startDate, 6);
    } else {
      startDate = startOfMonth(calendarMonth);
      endDate = endOfMonth(calendarMonth);
    }

    const days = eachDayOfInterval({ start: startDate, end: endDate });

    // Calculate which member is on-call for each day based on rotation
    const lastRotated = new Date(schedule.last_rotated_at || schedule.created_at);
    lastRotated.setHours(0, 0, 0, 0);

    return days.map((day) => {
      const dayStr = format(day, "yyyy-MM-dd");
      const override = overrides.find((o) => o.override_date === dayStr && o.schedule_id === calendarScheduleId);

      const dayStart = new Date(day);
      dayStart.setHours(0, 0, 0, 0);
      const daysSinceRotation = Math.floor((dayStart.getTime() - lastRotated.getTime()) / (1000 * 60 * 60 * 24));
      const rotationsSinceBase = Math.floor(daysSinceRotation / schedule.rotation_interval_days);
      const memberIndex = ((schedule.current_index + rotationsSinceBase) % schedMembers.length + schedMembers.length) % schedMembers.length;

      const overrideMember = override ? schedMembers.find((m) => m.id === override.member_id) : null;

      return {
        date: day,
        member: overrideMember || schedMembers[memberIndex],
        rotationMember: schedMembers[memberIndex],
        isToday: isToday(day),
        isCurrentMonth: isSameMonth(day, calendarMonth),
        isOverride: !!override,
        overrideId: override?.id,
        overrideReason: override?.reason,
        overrideCreatedAt: override?.created_at,
      };
    });
  }, [calendarScheduleId, calendarMonth, calendarView, schedules, members, overrides]);

  // Assign colors to members deterministically
  const memberColors = useMemo(() => {
    const colors = [
      "bg-primary/20 text-primary border-primary/30",
      "bg-chart-2/20 text-chart-2 border-chart-2/30",
      "bg-chart-3/20 text-chart-3 border-chart-3/30",
      "bg-chart-4/20 text-chart-4 border-chart-4/30",
      "bg-chart-5/20 text-chart-5 border-chart-5/30",
      "bg-warning/20 text-warning border-warning/30",
    ];
    const map: Record<string, string> = {};
    const selectedMembers = members[calendarScheduleId] || [];
    selectedMembers.forEach((m, i) => { map[m.id] = colors[i % colors.length]; });
    return map;
  }, [calendarScheduleId, members]);

  return (
    <TooltipProvider delayDuration={200}>
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">On-Call & Escalations</h1>
        <p className="text-sm text-muted-foreground">Manage rotation schedules and escalation policies</p>
      </div>

      <Tabs defaultValue="schedules">
        <TabsList>
          <TabsTrigger value="schedules"><Users className="mr-2 h-4 w-4" />Schedules</TabsTrigger>
          <TabsTrigger value="calendar"><CalendarDays className="mr-2 h-4 w-4" />Calendar</TabsTrigger>
          <TabsTrigger value="overrides"><History className="mr-2 h-4 w-4" />Override Log</TabsTrigger>
          <TabsTrigger value="escalations"><Shield className="mr-2 h-4 w-4" />Escalation Policies</TabsTrigger>
        </TabsList>

        {/* SCHEDULES TAB */}
        <TabsContent value="schedules" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Dialog open={schedDialogOpen} onOpenChange={setSchedDialogOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" />New Schedule</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create Rotation Schedule</DialogTitle></DialogHeader>
                <form onSubmit={createSchedule} className="space-y-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Schedule Name</Label>
                    <Input placeholder="e.g. Primary On-Call" value={schedName} onChange={(e) => setSchedName(e.target.value)} required />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Timezone</Label>
                      <Select value={schedTimezone} onValueChange={setSchedTimezone}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Europe/London", "Europe/Berlin", "Asia/Tokyo", "Asia/Kolkata"].map((tz) => (
                            <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Rotation (days)</Label>
                      <Input type="number" min={1} max={30} value={schedInterval} onChange={(e) => setSchedInterval(parseInt(e.target.value) || 1)} />
                    </div>
                  </div>
                  <Button type="submit" className="w-full">Create Schedule</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {schedules.map((schedule, i) => {
            const currentOnCall = getCurrentOnCall(schedule);
            const schedMembers = members[schedule.id] || [];
            return (
              <motion.div key={schedule.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card>
                  <CardHeader className="flex flex-row items-start justify-between pb-2">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Phone className="h-4 w-4 text-primary" />
                        {schedule.name}
                      </CardTitle>
                      <CardDescription>
                        {schedule.rotation_interval_days === 1 ? "Daily" : `Every ${schedule.rotation_interval_days} days`} rotation · {schedule.timezone}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {currentOnCall && (
                        <Badge className="bg-primary/10 text-primary border-primary/30">
                          <UserCheck className="mr-1 h-3 w-3" />
                          {currentOnCall.member_name}
                        </Badge>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => deleteSchedule(schedule.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Rotation Order</p>
                        <Button variant="outline" size="sm" onClick={() => { setMemberScheduleId(schedule.id); setMemberDialogOpen(true); }}>
                          <Plus className="mr-1 h-3 w-3" />Add Member
                        </Button>
                      </div>
                      {schedMembers.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">No members yet. Add team members to start the rotation.</p>
                      ) : (
                        <div className="space-y-1">
                          {schedMembers.map((member, idx) => (
                            <div key={member.id} className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${schedule.current_index % schedMembers.length === idx ? "bg-primary/10 border border-primary/20" : "bg-muted/30"}`}>
                              <div className="flex items-center gap-3">
                                <span className="font-mono text-xs text-muted-foreground w-6">#{idx + 1}</span>
                                <span className="font-medium">{member.member_name}</span>
                                {member.member_email && <span className="text-xs text-muted-foreground">{member.member_email}</span>}
                                {schedule.current_index % schedMembers.length === idx && (
                                  <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/30">ON CALL</Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveMember(member, "up")} disabled={idx === 0}>
                                  <ArrowUp className="h-3 w-3" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveMember(member, "down")} disabled={idx === schedMembers.length - 1}>
                                  <ArrowDown className="h-3 w-3" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeMember(member)}>
                                  <Trash2 className="h-3 w-3 text-destructive" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}

          {schedules.length === 0 && (
            <Card className="border-dashed border-2">
              <CardContent className="flex flex-col items-center py-12 text-center">
                <Phone className="mb-4 h-12 w-12 text-muted-foreground/50" />
                <h3 className="text-lg font-semibold">No schedules</h3>
                <p className="mt-1 text-sm text-muted-foreground">Create a rotation schedule to get started.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* CALENDAR TAB */}
        <TabsContent value="calendar" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Select value={calendarScheduleId} onValueChange={setCalendarScheduleId}>
                <SelectTrigger className="w-[200px]"><SelectValue placeholder="Select schedule..." /></SelectTrigger>
                <SelectContent>
                  {schedules.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex rounded-lg border border-border overflow-hidden">
                <button
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${calendarView === "week" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                  onClick={() => setCalendarView("week")}
                >Week</button>
                <button
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${calendarView === "month" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                  onClick={() => setCalendarView("month")}
                >Month</button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCalendarMonth((d) => {
                const n = new Date(d);
                if (calendarView === "week") n.setDate(n.getDate() - 7);
                else n.setMonth(n.getMonth() - 1);
                return n;
              })}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[140px] text-center">
                {calendarView === "week"
                  ? `${format(calendarData[0]?.date || new Date(), "MMM d")} – ${format(calendarData[calendarData.length - 1]?.date || new Date(), "MMM d, yyyy")}`
                  : format(calendarMonth, "MMMM yyyy")
                }
              </span>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCalendarMonth((d) => {
                const n = new Date(d);
                if (calendarView === "week") n.setDate(n.getDate() + 7);
                else n.setMonth(n.getMonth() + 1);
                return n;
              })}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setCalendarMonth(new Date())}>Today</Button>
              <Button variant="outline" size="sm" onClick={() => setBulkDialogOpen(true)}>
                <CalendarRange className="mr-1 h-3.5 w-3.5" />Bulk Override
              </Button>
            </div>
            <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-primary/40 border border-primary/60" />Normal rotation</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-warning/40 border border-warning/60" />Manual override</span>
            </div>
          </div>

          {schedules.length === 0 ? (
            <Card className="border-dashed border-2">
              <CardContent className="flex flex-col items-center py-12 text-center">
                <CalendarDays className="mb-4 h-12 w-12 text-muted-foreground/50" />
                <h3 className="text-lg font-semibold">No schedules</h3>
                <p className="mt-1 text-sm text-muted-foreground">Create a rotation schedule first.</p>
              </CardContent>
            </Card>
          ) : calendarView === "week" ? (
            /* Week View */
            <div className="grid grid-cols-7 gap-2">
              {calendarData.map((day) => {
                const tooltipContent = day.isOverride ? (
                  <div className="space-y-1 text-xs">
                    <p className="font-semibold text-warning">⚡ Manual Override</p>
                    <p><span className="text-muted-foreground">Assigned:</span> {day.member?.member_name}</p>
                    <p><span className="text-muted-foreground">Original:</span> {day.rotationMember?.member_name}</p>
                    {day.overrideReason && <p><span className="text-muted-foreground">Reason:</span> {day.overrideReason}</p>}
                    {day.overrideCreatedAt && <p><span className="text-muted-foreground">Set:</span> {format(new Date(day.overrideCreatedAt), "MMM d, yyyy 'at' h:mm a")}</p>}
                  </div>
                ) : day.member ? (
                  <div className="space-y-1 text-xs">
                    <p className="font-semibold">Normal Rotation</p>
                    <p><span className="text-muted-foreground">On-call:</span> {day.member.member_name}</p>
                  </div>
                ) : null;

                return (
                  <Tooltip key={day.date.toISOString()}>
                    <TooltipTrigger asChild>
                      <Card
                        className={`cursor-pointer transition-all hover:shadow-md ${day.isToday ? "border-primary ring-1 ring-primary/30" : "border-border/50"} ${day.isOverride ? "ring-2 ring-warning/60 border-warning/40 bg-warning/5" : ""}`}
                        onClick={() => openOverrideDialog(day.date)}
                      >
                        <CardContent className="p-3 space-y-2">
                          <div className="text-center">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{format(day.date, "EEE")}</p>
                            <p className={`text-lg font-bold ${day.isToday ? "text-primary" : ""}`}>{format(day.date, "d")}</p>
                            {day.isOverride ? (
                              <span className="inline-block h-1.5 w-1.5 rounded-full bg-warning" />
                            ) : (
                              <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary/30" />
                            )}
                          </div>
                          {day.member && (
                            <Badge variant="outline" className={`w-full justify-center text-[10px] ${memberColors[day.member.id] || ""}`}>
                              {day.isOverride && <RefreshCw className="h-2.5 w-2.5 mr-1" />}
                              {day.member.member_name}
                            </Badge>
                          )}
                          {day.isOverride && (
                            <p className="text-[9px] text-center text-warning font-medium">Override</p>
                          )}
                        </CardContent>
                      </Card>
                    </TooltipTrigger>
                    {tooltipContent && <TooltipContent side="bottom" className="max-w-[220px]">{tooltipContent}</TooltipContent>}
                  </Tooltip>
                );
              })}
            </div>
          ) : (
            /* Month View */
            <Card>
              <CardContent className="p-4">
                {/* Day headers */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                    <div key={d} className="text-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground py-1">{d}</div>
                  ))}
                </div>
                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-1">
                  {/* Padding for days before the first of the month */}
                  {(() => {
                    const firstDay = startOfMonth(calendarMonth);
                    const dayOfWeek = firstDay.getDay();
                    const padding = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                    return Array.from({ length: padding }).map((_, i) => <div key={`pad-${i}`} />);
                  })()}
                  {calendarData.map((day) => {
                    const tooltipContent = day.isOverride ? (
                      <div className="space-y-1 text-xs">
                        <p className="font-semibold text-warning">⚡ Manual Override</p>
                        <p><span className="text-muted-foreground">Assigned:</span> {day.member?.member_name}</p>
                        <p><span className="text-muted-foreground">Original:</span> {day.rotationMember?.member_name}</p>
                        {day.overrideReason && <p><span className="text-muted-foreground">Reason:</span> {day.overrideReason}</p>}
                        {day.overrideCreatedAt && <p><span className="text-muted-foreground">Set:</span> {format(new Date(day.overrideCreatedAt), "MMM d, yyyy 'at' h:mm a")}</p>}
                      </div>
                    ) : day.member ? (
                      <div className="space-y-1 text-xs">
                        <p className="font-semibold">Normal Rotation</p>
                        <p><span className="text-muted-foreground">On-call:</span> {day.member.member_name}</p>
                      </div>
                    ) : null;

                    return (
                      <Tooltip key={day.date.toISOString()}>
                        <TooltipTrigger asChild>
                          <div
                            onClick={() => openOverrideDialog(day.date)}
                            className={`rounded-lg p-1.5 min-h-[70px] border transition-colors cursor-pointer ${
                              day.isToday ? "border-primary bg-primary/5" : day.isCurrentMonth ? "border-border/30 hover:border-border" : "border-transparent opacity-40"
                            } ${day.isOverride ? "ring-2 ring-warning/50 border-warning/40 bg-warning/5" : ""}`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <p className={`text-xs font-medium ${day.isToday ? "text-primary" : ""}`}>{format(day.date, "d")}</p>
                              {day.isOverride ? (
                                <span className="inline-block h-1.5 w-1.5 rounded-full bg-warning" />
                              ) : day.member ? (
                                <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary/30" />
                              ) : null}
                            </div>
                            {day.member && (
                              <div className={`rounded px-1.5 py-0.5 text-[10px] font-medium truncate border ${memberColors[day.member.id] || "bg-muted text-muted-foreground"}`}>
                                {day.isOverride && <RefreshCw className="inline h-2.5 w-2.5 mr-0.5" />}
                                {day.member.member_name}
                              </div>
                            )}
                            {day.isOverride && day.overrideReason && (
                              <p className="text-[9px] text-warning truncate mt-0.5">{day.overrideReason}</p>
                            )}
                          </div>
                        </TooltipTrigger>
                        {tooltipContent && <TooltipContent side="top" className="max-w-[220px]">{tooltipContent}</TooltipContent>}
                      </Tooltip>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Legend */}
          {calendarScheduleId && (members[calendarScheduleId] || []).length > 0 && (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs text-muted-foreground">Legend:</span>
              {(members[calendarScheduleId] || []).map((m) => (
                <Badge key={m.id} variant="outline" className={`text-[10px] ${memberColors[m.id] || ""}`}>
                  {m.member_name}
                </Badge>
              ))}
            </div>
          )}
        </TabsContent>

        {/* OVERRIDE LOG TAB */}
        <TabsContent value="overrides" className="space-y-4 mt-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 flex-wrap">
              <Select value={calendarScheduleId} onValueChange={setCalendarScheduleId}>
                <SelectTrigger className="w-[200px]"><SelectValue placeholder="Select schedule..." /></SelectTrigger>
                <SelectContent>
                  {schedules.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={logFilterMember} onValueChange={(v) => { setLogFilterMember(v); setLogPage(0); }}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="All members" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All members</SelectItem>
                  {(members[calendarScheduleId] || []).map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.member_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input className="w-[180px] h-9 text-xs" placeholder="Search reason..." value={logFilterReason} onChange={(e) => { setLogFilterReason(e.target.value); setLogPage(0); }} />
              <div className="flex items-center gap-2">
                <Input type="date" className="w-[140px] h-9 text-xs" value={logFilterStart} onChange={(e) => { setLogFilterStart(e.target.value); setLogPage(0); }} placeholder="From" />
                <span className="text-xs text-muted-foreground">to</span>
                <Input type="date" className="w-[140px] h-9 text-xs" value={logFilterEnd} onChange={(e) => { setLogFilterEnd(e.target.value); setLogPage(0); }} placeholder="To" />
                {(logFilterStart || logFilterEnd || logFilterMember !== "all" || logFilterReason) && (
                  <Button variant="ghost" size="sm" className="h-9 px-2 text-xs" onClick={() => { setLogFilterStart(""); setLogFilterEnd(""); setLogFilterMember("all"); setLogFilterReason(""); setLogPage(0); }}>
                    Clear
                  </Button>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{sortedOverrides.length} override{sortedOverrides.length !== 1 ? "s" : ""}{(logFilterStart || logFilterEnd || logFilterMember !== "all" || logFilterReason) ? " (filtered)" : ""}</p>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground mr-1">Sort:</span>
                {([
                  { field: "created_at" as const, label: "Created" },
                  { field: "override_date" as const, label: "Date" },
                  { field: "member_name" as const, label: "Member" },
                ]).map(({ field, label }) => (
                  <Button
                    key={field}
                    variant={logSortField === field ? "secondary" : "ghost"}
                    size="sm"
                    className="h-7 px-2 text-xs gap-1"
                    onClick={() => {
                      if (logSortField === field) {
                        setLogSortDir((d) => d === "asc" ? "desc" : "asc");
                      } else {
                        setLogSortField(field);
                        setLogSortDir("desc");
                      }
                      setLogPage(0);
                    }}
                  >
                    {label}
                    {logSortField === field ? (
                      logSortDir === "asc" ? <ArrowUpNarrowWide className="h-3 w-3" /> : <ArrowDownNarrowWide className="h-3 w-3" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-40" />
                    )}
                  </Button>
                ))}
              </div>
            </div>
            {sortedOverrides.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => {
                const schedMembers = members[calendarScheduleId] || [];
                const schedule = schedules.find((s) => s.id === calendarScheduleId);
                const rows = sortedOverrides.map((ov) => {
                  const member = schedMembers.find((m) => m.id === ov.member_id);
                  return [
                    schedule?.name || "",
                    ov.override_date,
                    member?.member_name || "Unknown",
                    member?.member_email || "",
                    ov.reason || "",
                    format(new Date(ov.created_at), "yyyy-MM-dd HH:mm:ss"),
                  ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
                });
                const csv = ["Schedule,Override Date,Member,Email,Reason,Created At", ...rows].join("\n");
                const blob = new Blob([csv], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `oncall-overrides-${format(new Date(), "yyyy-MM-dd")}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}>
                <Download className="mr-1 h-3.5 w-3.5" />Export CSV
              </Button>
            )}
          </div>

          {sortedOverrides.length === 0 ? (
            <Card className="border-dashed border-2">
              <CardContent className="flex flex-col items-center py-12 text-center">
                <History className="mb-4 h-12 w-12 text-muted-foreground/50" />
                <h3 className="text-lg font-semibold">No overrides</h3>
                <p className="mt-1 text-sm text-muted-foreground">Click a day in the Calendar tab to add an override.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardContent className="p-0">
                  <div className="divide-y divide-border">
                    {sortedOverrides.slice(logPage * LOG_PAGE_SIZE, (logPage + 1) * LOG_PAGE_SIZE).map((ov) => {
                      const schedMembers = members[calendarScheduleId] || [];
                      const member = schedMembers.find((m) => m.id === ov.member_id);
                      const schedule = schedules.find((s) => s.id === ov.schedule_id);
                      return (
                        <div key={ov.id} className="flex items-center justify-between px-4 py-3">
                          <div className="flex items-center gap-4">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-warning/10 text-warning">
                              <RefreshCw className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">
                                <span className="font-semibold">{member?.member_name || "Unknown"}</span>
                                {" assigned to "}
                                <span className="font-semibold">{format(new Date(ov.override_date + "T00:00:00"), "MMM d, yyyy")}</span>
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                {ov.reason && (
                                  <span className="text-xs text-muted-foreground">Reason: {ov.reason}</span>
                                )}
                                <span className="text-xs text-muted-foreground">
                                  Created {format(new Date(ov.created_at), "MMM d, yyyy 'at' h:mm a")}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditOverride(ov); setEditMemberId(ov.member_id); setEditReason(ov.reason || ""); }}>
                              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteOverrideId(ov.id)}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
              {sortedOverrides.length > LOG_PAGE_SIZE && (
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Showing {logPage * LOG_PAGE_SIZE + 1}–{Math.min((logPage + 1) * LOG_PAGE_SIZE, sortedOverrides.length)} of {sortedOverrides.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={logPage === 0} onClick={() => setLogPage((p) => p - 1)}>
                      <ChevronLeft className="mr-1 h-3.5 w-3.5" />Previous
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      Page {logPage + 1} of {Math.ceil(sortedOverrides.length / LOG_PAGE_SIZE)}
                    </span>
                    <Button variant="outline" size="sm" disabled={(logPage + 1) * LOG_PAGE_SIZE >= sortedOverrides.length} onClick={() => setLogPage((p) => p + 1)}>
                      Next<ChevronRight className="ml-1 h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="escalations" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Dialog open={policyDialogOpen} onOpenChange={setPolicyDialogOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" />New Policy</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create Escalation Policy</DialogTitle></DialogHeader>
                <form onSubmit={createPolicy} className="space-y-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Policy Name</Label>
                    <Input placeholder="e.g. Critical Incidents" value={policyName} onChange={(e) => setPolicyName(e.target.value)} required />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Description</Label>
                    <Input placeholder="Optional description" value={policyDesc} onChange={(e) => setPolicyDesc(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Repeat escalation cycle</Label>
                    <Input type="number" min={0} max={10} value={policyRepeat} onChange={(e) => setPolicyRepeat(parseInt(e.target.value) || 0)} />
                    <p className="text-xs text-muted-foreground mt-1">0 = no repeat, 3 = cycle through levels 3 more times</p>
                  </div>
                  <Button type="submit" className="w-full">Create Policy</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {policies.map((policy, i) => {
            const policyLevels = (levels[policy.id] || []).sort((a, b) => a.level_order - b.level_order);
            return (
              <motion.div key={policy.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card>
                  <CardHeader className="flex flex-row items-start justify-between pb-2">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Shield className="h-4 w-4 text-primary" />
                        {policy.name}
                      </CardTitle>
                      {policy.description && <CardDescription>{policy.description}</CardDescription>}
                      <p className="text-xs text-muted-foreground mt-1">
                        {policyLevels.length} level{policyLevels.length !== 1 ? "s" : ""} · Repeat: {policy.repeat_count}x
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => { setLevelPolicyId(policy.id); setLevelDialogOpen(true); }}>
                        <Plus className="mr-1 h-3 w-3" />Add Level
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deletePolicy(policy.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {policyLevels.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">No escalation levels. Add levels to define the escalation chain.</p>
                    ) : (
                      <div className="relative">
                        {/* Escalation chain visualization */}
                        <div className="absolute left-5 top-4 bottom-4 w-px bg-border" />
                        <div className="space-y-3">
                          {policyLevels.map((level, idx) => {
                            const linkedSchedule = schedules.find((s) => s.id === level.schedule_id);
                            return (
                              <div key={level.id} className="relative flex items-start gap-4 pl-3">
                                <div className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                                  {idx + 1}
                                </div>
                                <div className="flex-1 rounded-lg border border-border bg-muted/20 p-3">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline" className="text-[10px]">{notifyMethods.find((m) => m.value === level.notify_method)?.label || level.notify_method}</Badge>
                                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Clock className="h-3 w-3" />{level.timeout_minutes}min timeout
                                      </span>
                                    </div>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeLevel(level)}>
                                      <Trash2 className="h-3 w-3 text-destructive" />
                                    </Button>
                                  </div>
                                  <div className="mt-1 text-sm">
                                    {linkedSchedule ? (
                                      <span>Notify on-call from <strong>{linkedSchedule.name}</strong></span>
                                    ) : level.contact_name ? (
                                      <span>Notify <strong>{level.contact_name}</strong>{level.contact_email ? ` (${level.contact_email})` : ""}</span>
                                    ) : (
                                      <span className="text-muted-foreground">No target configured</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}

          {policies.length === 0 && (
            <Card className="border-dashed border-2">
              <CardContent className="flex flex-col items-center py-12 text-center">
                <Shield className="mb-4 h-12 w-12 text-muted-foreground/50" />
                <h3 className="text-lg font-semibold">No escalation policies</h3>
                <p className="mt-1 text-sm text-muted-foreground">Create a policy to define how incidents escalate.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Add member dialog */}
      <Dialog open={memberDialogOpen} onOpenChange={setMemberDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Team Member</DialogTitle></DialogHeader>
          <form onSubmit={addMember} className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Name</Label>
              <Input placeholder="e.g. Jane Doe" value={memberName} onChange={(e) => setMemberName(e.target.value)} required />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Email (optional)</Label>
              <Input placeholder="jane@company.com" value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} />
            </div>
            <Button type="submit" className="w-full">Add Member</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add escalation level dialog */}
      <Dialog open={levelDialogOpen} onOpenChange={setLevelDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Escalation Level</DialogTitle></DialogHeader>
          <form onSubmit={addLevel} className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Notification Method</Label>
              <Select value={levelNotify} onValueChange={setLevelNotify}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {notifyMethods.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Timeout (minutes before escalating)</Label>
              <Input type="number" min={1} max={120} value={levelTimeout} onChange={(e) => setLevelTimeout(parseInt(e.target.value) || 15)} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Link to On-Call Schedule (optional)</Label>
              <Select value={levelScheduleId} onValueChange={setLevelScheduleId}>
                <SelectTrigger><SelectValue placeholder="Select schedule..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {schedules.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Contact Name</Label>
                <Input placeholder="Backup contact" value={levelContactName} onChange={(e) => setLevelContactName(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Contact Email</Label>
                <Input placeholder="backup@company.com" value={levelContactEmail} onChange={(e) => setLevelContactEmail(e.target.value)} />
              </div>
            </div>
            <Button type="submit" className="w-full">Add Level</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Override dialog */}
      <Dialog open={overrideDialogOpen} onOpenChange={setOverrideDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {overrideDate ? `Override: ${format(overrideDate, "MMMM d, yyyy")}` : "Override"}
            </DialogTitle>
            <DialogDescription>
              Manually assign a team member for this day, overriding the normal rotation.
            </DialogDescription>
          </DialogHeader>
          {(() => {
            const existingOverride = overrideDate
              ? calendarData.find((d) => isSameDay(d.date, overrideDate) && d.isOverride)
              : null;
            const schedMembers = members[calendarScheduleId] || [];
            return (
              <div className="space-y-4">
                {existingOverride && (
                  <div className="rounded-lg border border-warning/30 bg-warning/10 p-3">
                    <p className="text-sm font-medium text-warning">Active override</p>
                    <p className="text-sm">{existingOverride.member?.member_name} is assigned</p>
                    {existingOverride.overrideReason && (
                      <p className="text-xs text-muted-foreground mt-1">Reason: {existingOverride.overrideReason}</p>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => {
                        if (existingOverride.overrideId) removeOverride(existingOverride.overrideId);
                        setOverrideDialogOpen(false);
                      }}
                    >
                      <Trash2 className="h-3 w-3 mr-1" />Remove Override
                    </Button>
                  </div>
                )}
                <div>
                  <Label className="text-xs text-muted-foreground">Assign Member</Label>
                  <Select value={overrideMemberId} onValueChange={setOverrideMemberId}>
                    <SelectTrigger><SelectValue placeholder="Select member..." /></SelectTrigger>
                    <SelectContent>
                      {schedMembers.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.member_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Reason (optional)</Label>
                  <Input
                    placeholder="e.g. PTO coverage, swap request"
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                  />
                </div>
                <Button
                  className="w-full"
                  disabled={!overrideMemberId}
                  onClick={addOverride}
                >
                  {existingOverride ? "Update Override" : "Set Override"}
                </Button>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Bulk override dialog */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Override</DialogTitle>
            <DialogDescription>Assign a member for a range of dates (e.g. PTO coverage).</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Start Date</Label>
                <Input type="date" value={bulkStartDate} onChange={(e) => setBulkStartDate(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">End Date</Label>
                <Input type="date" value={bulkEndDate} onChange={(e) => setBulkEndDate(e.target.value)} />
              </div>
            </div>
            {bulkStartDate && bulkEndDate && new Date(bulkEndDate) >= new Date(bulkStartDate) && (
              <p className="text-xs text-muted-foreground">
                {eachDayOfInterval({ start: new Date(bulkStartDate), end: new Date(bulkEndDate) }).length} day(s) selected
              </p>
            )}
            <div>
              <Label className="text-xs text-muted-foreground">Assign Member</Label>
              <Select value={bulkMemberId} onValueChange={setBulkMemberId}>
                <SelectTrigger><SelectValue placeholder="Select member..." /></SelectTrigger>
                <SelectContent>
                  {(members[calendarScheduleId] || []).map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.member_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Reason (optional)</Label>
              <Input placeholder="e.g. Alice on PTO" value={bulkReason} onChange={(e) => setBulkReason(e.target.value)} />
            </div>
            <Button
              className="w-full"
              disabled={!bulkStartDate || !bulkEndDate || !bulkMemberId}
              onClick={addBulkOverrides}
            >
              Apply Bulk Override
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete override confirmation */}
      <AlertDialog open={!!deleteOverrideId} onOpenChange={(open) => { if (!open) setDeleteOverrideId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Override</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this override? The regular on-call rotation will apply for this date. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteOverrideId) removeOverride(deleteOverrideId);
                setDeleteOverrideId(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit override dialog */}
      <Dialog open={!!editOverride} onOpenChange={(open) => { if (!open) setEditOverride(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Override</DialogTitle>
            <DialogDescription>
              {editOverride && `Override for ${format(new Date(editOverride.override_date + "T00:00:00"), "MMM d, yyyy")}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Assigned Member</Label>
              <Select value={editMemberId} onValueChange={setEditMemberId}>
                <SelectTrigger><SelectValue placeholder="Select member..." /></SelectTrigger>
                <SelectContent>
                  {(members[calendarScheduleId] || []).map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.member_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Reason (optional)</Label>
              <Input placeholder="e.g. Covering PTO" value={editReason} onChange={(e) => setEditReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOverride(null)}>Cancel</Button>
            <Button onClick={updateOverride} disabled={!editMemberId}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  );
}
