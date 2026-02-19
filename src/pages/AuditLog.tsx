import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollText, Search, ShieldAlert, Loader2, Download, CalendarIcon, X, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, formatDistanceToNow, startOfDay, endOfDay, subDays, addMonths, setMonth, setDate, startOfYear } from "date-fns";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// --- Fiscal helpers ---

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getFiscalYearStart(fiscalStartMonth: number): Date {
  const now = new Date();
  const currentMonth = now.getMonth(); // 0-indexed
  // If current month is before fiscal start, fiscal year started last calendar year
  const year = currentMonth >= fiscalStartMonth ? now.getFullYear() : now.getFullYear() - 1;
  return setDate(setMonth(new Date(year, 0, 1), fiscalStartMonth), 1);
}

function getFiscalQuarterRange(fiscalStartMonth: number, offset: number): { from: Date; to: Date; label: string } {
  const now = new Date();
  const fyStart = getFiscalYearStart(fiscalStartMonth);

  // Current fiscal quarter number (1-based)
  const monthsSinceFYStart = (now.getMonth() - fiscalStartMonth + 12) % 12;
  const currentFQ = Math.floor(monthsSinceFYStart / 3); // 0-based

  const targetFQ = currentFQ - offset;

  // Calculate start of the target fiscal quarter
  const qStart = addMonths(fyStart, (targetFQ) * 3);
  // If targetFQ goes negative, we need to go back a fiscal year
  const adjustedStart = targetFQ < 0
    ? addMonths(addMonths(fyStart, -12), (targetFQ + 4) * 3)
    : qStart;

  const adjustedEnd = addMonths(adjustedStart, 3);
  const endDate = adjustedEnd > now ? now : new Date(adjustedEnd.getTime() - 1);

  // Determine FQ number for label
  const fqNum = ((targetFQ % 4) + 4) % 4 + 1;
  const labelYear = adjustedStart.getFullYear() + (fiscalStartMonth > 0 && adjustedStart.getMonth() >= fiscalStartMonth ? 1 : 0);
  const label = `FQ${fqNum} ${fiscalStartMonth === 0 ? adjustedStart.getFullYear() : `FY${labelYear}`}`;

  return { from: adjustedStart, to: endDate, label };
}

// --- Component ---

interface AuditEntry {
  id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
  profiles?: { display_name: string | null } | null;
}

const actionStyles: Record<string, string> = {
  api_key_generated: "bg-chart-2/15 text-chart-2",
  api_key_revoked: "bg-warning/15 text-warning",
  api_key_deleted: "bg-destructive/15 text-destructive",
  api_key_generate_rate_limited: "bg-destructive/15 text-destructive",
  role_changed: "bg-primary/15 text-primary",
  user_removed: "bg-destructive/15 text-destructive",
  webhook_created: "bg-chart-2/15 text-chart-2",
  webhook_deleted: "bg-destructive/15 text-destructive",
  incident_ai_analysis: "bg-primary/15 text-primary",
  incident_escalated: "bg-warning/15 text-warning",
};

const actionLabels: Record<string, string> = {
  api_key_generated: "API Key Generated",
  api_key_revoked: "API Key Revoked",
  api_key_deleted: "API Key Deleted",
  api_key_generate_rate_limited: "Rate Limited",
  role_changed: "Role Changed",
  user_removed: "User Removed",
  webhook_created: "Webhook Created",
  webhook_deleted: "Webhook Deleted",
  incident_ai_analysis: "AI Analysis",
  incident_escalated: "Incident Escalated",
};

export default function AuditLog() {
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [fiscalQuarterOffset, setFiscalQuarterOffset] = useState(0);
  const [fiscalStartMonth, setFiscalStartMonth] = useState(() => {
    const saved = localStorage.getItem("audit_fiscal_start_month");
    return saved !== null ? parseInt(saved, 10) : 0; // default January (0-indexed)
  });

  const handleFiscalMonthChange = useCallback((value: string) => {
    const month = parseInt(value, 10);
    setFiscalStartMonth(month);
    localStorage.setItem("audit_fiscal_start_month", value);
    setFiscalQuarterOffset(0);
  }, []);

  const datePresets = useMemo(() => [
    { label: "Last 7 days", getRange: () => ({ from: subDays(new Date(), 7), to: new Date() }) },
    { label: "Last 30 days", getRange: () => ({ from: subDays(new Date(), 30), to: new Date() }) },
    { label: "Last 90 days", getRange: () => ({ from: subDays(new Date(), 90), to: new Date() }) },
    { label: "This FY quarter", getRange: () => {
      const { from, to } = getFiscalQuarterRange(fiscalStartMonth, 0);
      return { from, to };
    }},
    { label: "Fiscal YTD", getRange: () => ({ from: getFiscalYearStart(fiscalStartMonth), to: new Date() }) },
  ], [fiscalStartMonth]);

  useEffect(() => {
    if (!user || roleLoading) return;
    fetchEntries();
  }, [user, roleLoading, actionFilter, dateFrom, dateTo]);

  const fetchEntries = async () => {
    setLoading(true);
    let query = (supabase as any)
      .from("audit_log")
      .select("*, profiles!audit_log_user_id_fkey(display_name)")
      .order("created_at", { ascending: false })
      .limit(200);

    if (actionFilter !== "all") query = query.eq("action", actionFilter);
    if (dateFrom) query = query.gte("created_at", startOfDay(dateFrom).toISOString());
    if (dateTo) query = query.lte("created_at", endOfDay(dateTo).toISOString());

    const { data } = await query;
    if (data) setEntries(data);
    setLoading(false);
  };

  const filtered = entries.filter((e) => {
    const s = search.toLowerCase();
    return (
      e.action.toLowerCase().includes(s) ||
      e.resource_type.toLowerCase().includes(s) ||
      (e.profiles?.display_name || "").toLowerCase().includes(s) ||
      JSON.stringify(e.details).toLowerCase().includes(s)
    );
  });

  const exportCsv = () => {
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const headers = ["Timestamp", "User", "Action", "Resource Type", "Resource ID", "Details"];
    const rows = filtered.map((e) => [
      format(new Date(e.created_at), "yyyy-MM-dd HH:mm:ss"),
      e.profiles?.display_name || "Unknown",
      actionLabels[e.action] ?? e.action,
      e.resource_type,
      e.resource_id || "",
      JSON.stringify(e.details || {}),
    ]);
    const csv = [headers, ...rows].map((r) => r.map(escape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const suffix = dateFrom && dateTo
      ? `${format(dateFrom, "yyyy-MM-dd")}_to_${format(dateTo, "yyyy-MM-dd")}`
      : format(new Date(), "yyyy-MM-dd");
    a.download = `audit-log-${suffix}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Fiscal quarter nav
  const fiscalQ = useMemo(() => getFiscalQuarterRange(fiscalStartMonth, fiscalQuarterOffset), [fiscalStartMonth, fiscalQuarterOffset]);
  const isFQActive = dateFrom && dateTo &&
    format(dateFrom, "yyyy-MM-dd") === format(fiscalQ.from, "yyyy-MM-dd") &&
    format(dateTo, "yyyy-MM-dd") === format(fiscalQ.to, "yyyy-MM-dd");

  if (!roleLoading && !isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-12 text-center">
        <ShieldAlert className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h2 className="text-lg font-semibold">Admin Access Required</h2>
        <p className="text-sm text-muted-foreground mt-1">Only admins can view the activity log.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Activity Log</h1>
          <p className="text-sm text-muted-foreground">Track all admin actions across the platform</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Fiscal year config */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="text-xs gap-1.5">
                <Settings2 className="h-3.5 w-3.5" />
                FY starts {MONTH_NAMES[fiscalStartMonth]}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 pointer-events-auto" align="end">
              <div className="space-y-2">
                <p className="text-sm font-medium">Fiscal Year Start</p>
                <p className="text-xs text-muted-foreground">Choose the month your fiscal year begins. This adjusts quarter and YTD calculations.</p>
                <Select value={String(fiscalStartMonth)} onValueChange={handleFiscalMonthChange}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTH_NAMES.map((name, i) => (
                      <SelectItem key={i} value={String(i)}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </PopoverContent>
          </Popover>

          <Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="mr-1.5 h-3.5 w-3.5" />Export CSV
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search activity..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="api_key_generated">Key Generated</SelectItem>
            <SelectItem value="api_key_revoked">Key Revoked</SelectItem>
            <SelectItem value="api_key_deleted">Key Deleted</SelectItem>
            <SelectItem value="api_key_generate_rate_limited">Rate Limited</SelectItem>
            <SelectItem value="role_changed">Role Changed</SelectItem>
            <SelectItem value="user_removed">User Removed</SelectItem>
            <SelectItem value="webhook_created">Webhook Created</SelectItem>
            <SelectItem value="webhook_deleted">Webhook Deleted</SelectItem>
            <SelectItem value="incident_ai_analysis">AI Analysis</SelectItem>
            <SelectItem value="incident_escalated">Incident Escalated</SelectItem>
          </SelectContent>
        </Select>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("w-[140px] justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
              <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
              {dateFrom ? format(dateFrom, "MMM d, yyyy") : "From date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus disabled={(date) => dateTo ? date > dateTo : false} className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("w-[140px] justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
              <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
              {dateTo ? format(dateTo, "MMM d, yyyy") : "To date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus disabled={(date) => dateFrom ? date < dateFrom : false} className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
        {(dateFrom || dateTo) && (
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}>
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Date presets + fiscal quarter nav */}
      <div className="flex flex-wrap items-center gap-2">
        {datePresets.map((preset) => {
          const { from, to } = preset.getRange();
          const isActive = dateFrom && dateTo &&
            format(dateFrom, "yyyy-MM-dd") === format(from, "yyyy-MM-dd") &&
            format(dateTo, "yyyy-MM-dd") === format(to, "yyyy-MM-dd");
          return (
            <Button
              key={preset.label}
              variant={isActive ? "default" : "outline"}
              size="sm"
              className="text-xs h-7"
              onClick={() => { setDateFrom(from); setDateTo(to); }}
            >
              {preset.label}
            </Button>
          );
        })}

        <span className="text-xs text-muted-foreground mx-1">|</span>

        {/* Fiscal quarter navigator */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7 px-2"
            onClick={() => {
              const newOffset = fiscalQuarterOffset + 1;
              setFiscalQuarterOffset(newOffset);
              const { from, to } = getFiscalQuarterRange(fiscalStartMonth, newOffset);
              setDateFrom(from);
              setDateTo(to);
            }}
          >
            ‹
          </Button>
          <Button
            variant={isFQActive ? "default" : "outline"}
            size="sm"
            className="text-xs h-7 min-w-[90px]"
            onClick={() => { setDateFrom(fiscalQ.from); setDateTo(fiscalQ.to); }}
          >
            {fiscalQ.label}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7 px-2"
            disabled={fiscalQuarterOffset === 0}
            onClick={() => {
              const newOffset = Math.max(0, fiscalQuarterOffset - 1);
              setFiscalQuarterOffset(newOffset);
              const { from, to } = getFiscalQuarterRange(fiscalStartMonth, newOffset);
              setDateFrom(from);
              setDateTo(to);
            }}
          >
            ›
          </Button>
        </div>
      </div>

      <Card className="border-border/50 overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="divide-y divide-border max-h-[70vh] overflow-auto">
              {filtered.map((entry, i) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors"
                >
                  <Badge variant="outline" className={`mt-0.5 shrink-0 text-xs ${actionStyles[entry.action] ?? "bg-muted text-muted-foreground"}`}>
                    {actionLabels[entry.action] ?? entry.action}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <span className="font-medium">{entry.profiles?.display_name || "Unknown"}</span>
                      <span className="text-muted-foreground"> performed </span>
                      <span className="font-mono text-xs">{entry.action}</span>
                      <span className="text-muted-foreground"> on </span>
                      <span className="font-medium">{entry.resource_type}</span>
                    </p>
                    {Object.keys(entry.details || {}).length > 0 && (
                      <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">
                        {JSON.stringify(entry.details)}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground font-mono" title={format(new Date(entry.created_at), "PPpp")}>
                    {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                  </span>
                </motion.div>
              ))}
              {filtered.length === 0 && (
                <div className="flex flex-col items-center py-12 text-center">
                  <ScrollText className="mb-4 h-10 w-10 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">No activity found</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
