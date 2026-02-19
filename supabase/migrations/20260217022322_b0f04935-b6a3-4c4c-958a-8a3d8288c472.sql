
-- Runbook/playbook definitions
CREATE TABLE public.runbooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  trigger_conditions JSONB NOT NULL DEFAULT '{}',
  steps JSONB NOT NULL DEFAULT '[]',
  cooldown_minutes INTEGER NOT NULL DEFAULT 30,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.runbooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own runbooks" ON public.runbooks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own runbooks" ON public.runbooks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own runbooks" ON public.runbooks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own runbooks" ON public.runbooks FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_runbooks_updated_at
  BEFORE UPDATE ON public.runbooks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Runbook execution log
CREATE TABLE public.runbook_executions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  runbook_id UUID NOT NULL REFERENCES public.runbooks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  incident_id UUID REFERENCES public.incidents(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'running',
  steps_completed JSONB NOT NULL DEFAULT '[]',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  error_message TEXT
);

ALTER TABLE public.runbook_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own executions" ON public.runbook_executions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own executions" ON public.runbook_executions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own executions" ON public.runbook_executions FOR UPDATE USING (auth.uid() = user_id);

-- Enable pg_cron and pg_net for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Enable realtime for runbook_executions
ALTER PUBLICATION supabase_realtime ADD TABLE public.runbook_executions;
