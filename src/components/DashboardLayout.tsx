import { ReactNode, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useUserRole } from "@/hooks/useUserRole";
import { cn } from "@/lib/utils";
import {
  Activity, BarChart3, Bell, FileText, GitBranch, LayoutDashboard,
  LogOut, Moon, Server, Settings, Sun, ChevronLeft, ChevronRight, Zap, Route, Target, Users, BookOpen, Phone, Globe, ScrollText, ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import NotificationCenter from "@/components/NotificationCenter";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/", adminOnly: false },
  { icon: Server, label: "Servers", path: "/servers", adminOnly: false },
  { icon: GitBranch, label: "Service Map", path: "/services", adminOnly: false },
  { icon: BarChart3, label: "Metrics", path: "/metrics", adminOnly: false },
  { icon: FileText, label: "Logs", path: "/logs", adminOnly: false },
  { icon: Zap, label: "Incidents", path: "/incidents", adminOnly: false },
  { icon: Bell, label: "Alerts", path: "/alerts", adminOnly: false },
  { icon: Route, label: "Traces", path: "/traces", adminOnly: false },
  { icon: Target, label: "SLOs", path: "/slos", adminOnly: false },
  { icon: BookOpen, label: "Runbooks", path: "/runbooks", adminOnly: false },
  { icon: Phone, label: "On-Call", path: "/oncall", adminOnly: false },
  { icon: Globe, label: "Status Pages", path: "/status-admin", adminOnly: false },
  { icon: ClipboardList, label: "Exec Summary", path: "/executive-summary", adminOnly: false },
  { icon: Users, label: "Team", path: "/team", adminOnly: true },
  { icon: ScrollText, label: "Activity Log", path: "/audit-log", adminOnly: true },
  { icon: Settings, label: "Settings", path: "/settings", adminOnly: false },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { signOut, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { isAdmin, role } = useUserRole();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const filteredNavItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 72 : 240 }}
        transition={{ duration: 0.2 }}
        className="relative flex flex-col border-r border-sidebar-border bg-sidebar"
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Activity className="h-5 w-5 text-primary" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-lg font-bold tracking-tight text-foreground"
              >
                ObserveX
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 p-3">
          {filteredNavItems.map(({ icon: Icon, label, path }) => {
            const active = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      {label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="space-y-1 border-t border-sidebar-border p-3">
          <button onClick={signOut} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground hover:bg-sidebar-accent">
            <LogOut className="h-5 w-5 shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm hover:text-foreground"
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>
      </motion.aside>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-14 items-center justify-end gap-2 border-b border-border bg-card px-4">
          <NotificationCenter />
          <button onClick={toggleTheme} className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </header>
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
