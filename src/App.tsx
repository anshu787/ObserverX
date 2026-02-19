import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import DashboardLayout from "@/components/DashboardLayout";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import Servers from "@/pages/Servers";
import Services from "@/pages/Services";
import Metrics from "@/pages/Metrics";
import Logs from "@/pages/Logs";
import Incidents from "@/pages/Incidents";
import Alerts from "@/pages/Alerts";
import Traces from "@/pages/Traces";
import SLODashboard from "@/pages/SLODashboard";
import TeamManagement from "@/pages/TeamManagement";
import Runbooks from "@/pages/Runbooks";
import OnCall from "@/pages/OnCall";
import StatusPageAdmin from "@/pages/StatusPageAdmin";
import PublicStatusPage from "@/pages/PublicStatusPage";
import SettingsPage from "@/pages/SettingsPage";
import AuditLog from "@/pages/AuditLog";
import IncidentStory from "@/pages/IncidentStory";
import ExecutiveSummary from "@/pages/ExecutiveSummary";
import LandingPage from "@/pages/LandingPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center bg-background"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  if (!session) return <Navigate to="/landing" replace />;
  return <DashboardLayout>{children}</DashboardLayout>;
}

function LandingRoute() {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (session) return <Navigate to="/" replace />;
  return <LandingPage />;
}

function AuthRoute() {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (session) return <Navigate to="/" replace />;
  return <Auth />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/landing" element={<LandingRoute />} />
              <Route path="/auth" element={<AuthRoute />} />
              <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/servers" element={<ProtectedRoute><Servers /></ProtectedRoute>} />
              <Route path="/services" element={<ProtectedRoute><Services /></ProtectedRoute>} />
              <Route path="/metrics" element={<ProtectedRoute><Metrics /></ProtectedRoute>} />
              <Route path="/logs" element={<ProtectedRoute><Logs /></ProtectedRoute>} />
              <Route path="/incidents" element={<ProtectedRoute><Incidents /></ProtectedRoute>} />
              <Route path="/alerts" element={<ProtectedRoute><Alerts /></ProtectedRoute>} />
              <Route path="/traces" element={<ProtectedRoute><Traces /></ProtectedRoute>} />
              <Route path="/slos" element={<ProtectedRoute><SLODashboard /></ProtectedRoute>} />
              <Route path="/team" element={<ProtectedRoute><TeamManagement /></ProtectedRoute>} />
              <Route path="/runbooks" element={<ProtectedRoute><Runbooks /></ProtectedRoute>} />
              <Route path="/oncall" element={<ProtectedRoute><OnCall /></ProtectedRoute>} />
              <Route path="/status-admin" element={<ProtectedRoute><StatusPageAdmin /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
              <Route path="/audit-log" element={<ProtectedRoute><AuditLog /></ProtectedRoute>} />
              <Route path="/incidents/:id/story" element={<ProtectedRoute><IncidentStory /></ProtectedRoute>} />
              <Route path="/executive-summary" element={<ProtectedRoute><ExecutiveSummary /></ProtectedRoute>} />
              <Route path="/status/:slug" element={<PublicStatusPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
