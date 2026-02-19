
-- Incident events for timeline replay
CREATE TABLE public.incident_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID REFERENCES public.incidents(id) ON DELETE CASCADE NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('metric_spike', 'log_error', 'alert_triggered', 'service_degraded', 'status_change', 'ai_analysis', 'resolution')),
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  metadata JSONB DEFAULT '{}',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.incident_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view incident events" ON public.incident_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.incidents WHERE incidents.id = incident_events.incident_id AND incidents.user_id = auth.uid()));
CREATE POLICY "Users can insert incident events" ON public.incident_events FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.incidents WHERE incidents.id = incident_events.incident_id AND incidents.user_id = auth.uid()));
CREATE INDEX idx_incident_events_incident ON public.incident_events (incident_id, occurred_at);

-- Alert rules table for configurable thresholds
CREATE TABLE public.alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  metric_type TEXT NOT NULL CHECK (metric_type IN ('cpu', 'memory', 'disk', 'network', 'latency', 'error_rate')),
  operator TEXT NOT NULL DEFAULT '>' CHECK (operator IN ('>', '<', '>=', '<=', '=')),
  threshold DOUBLE PRECISION NOT NULL,
  duration_seconds INTEGER NOT NULL DEFAULT 60,
  severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  correlation_metric TEXT CHECK (correlation_metric IN ('cpu', 'memory', 'disk', 'network', 'latency', 'error_rate', NULL)),
  correlation_operator TEXT CHECK (correlation_operator IN ('>', '<', '>=', '<=', '=', NULL)),
  correlation_threshold DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own rules" ON public.alert_rules FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own rules" ON public.alert_rules FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own rules" ON public.alert_rules FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own rules" ON public.alert_rules FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER update_alert_rules_updated_at BEFORE UPDATE ON public.alert_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.incident_events;
