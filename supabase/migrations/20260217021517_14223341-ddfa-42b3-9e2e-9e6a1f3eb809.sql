
-- SLO definitions table
CREATE TABLE public.slo_definitions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slo_type TEXT NOT NULL DEFAULT 'uptime', -- 'uptime' or 'latency'
  target_percentage DOUBLE PRECISION NOT NULL DEFAULT 99.9,
  latency_threshold_ms DOUBLE PRECISION, -- for latency SLOs
  window_days INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.slo_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own SLOs" ON public.slo_definitions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own SLOs" ON public.slo_definitions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own SLOs" ON public.slo_definitions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own SLOs" ON public.slo_definitions FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_slo_definitions_updated_at
  BEFORE UPDATE ON public.slo_definitions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add trace correlation columns to logs
ALTER TABLE public.logs ADD COLUMN trace_id TEXT;
ALTER TABLE public.logs ADD COLUMN span_id TEXT;

CREATE INDEX idx_logs_trace_id ON public.logs(trace_id);
CREATE INDEX idx_logs_span_id ON public.logs(span_id);
