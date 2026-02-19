
-- On-call schedules (daily rotation)
CREATE TABLE public.oncall_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  rotation_interval_days INTEGER NOT NULL DEFAULT 1,
  current_index INTEGER NOT NULL DEFAULT 0,
  last_rotated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.oncall_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own schedules" ON public.oncall_schedules FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own schedules" ON public.oncall_schedules FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own schedules" ON public.oncall_schedules FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own schedules" ON public.oncall_schedules FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER update_oncall_schedules_updated_at BEFORE UPDATE ON public.oncall_schedules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- On-call members in rotation order
CREATE TABLE public.oncall_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  schedule_id UUID NOT NULL REFERENCES public.oncall_schedules(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  member_name TEXT NOT NULL,
  member_email TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.oncall_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view members of own schedules" ON public.oncall_members FOR SELECT USING (EXISTS (SELECT 1 FROM oncall_schedules WHERE oncall_schedules.id = oncall_members.schedule_id AND oncall_schedules.user_id = auth.uid()));
CREATE POLICY "Users can insert members to own schedules" ON public.oncall_members FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM oncall_schedules WHERE oncall_schedules.id = oncall_members.schedule_id AND oncall_schedules.user_id = auth.uid()));
CREATE POLICY "Users can update members of own schedules" ON public.oncall_members FOR UPDATE USING (EXISTS (SELECT 1 FROM oncall_schedules WHERE oncall_schedules.id = oncall_members.schedule_id AND oncall_schedules.user_id = auth.uid()));
CREATE POLICY "Users can delete members from own schedules" ON public.oncall_members FOR DELETE USING (EXISTS (SELECT 1 FROM oncall_schedules WHERE oncall_schedules.id = oncall_members.schedule_id AND oncall_schedules.user_id = auth.uid()));

-- Escalation policies with unlimited levels
CREATE TABLE public.escalation_policies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  repeat_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.escalation_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own policies" ON public.escalation_policies FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own policies" ON public.escalation_policies FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own policies" ON public.escalation_policies FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own policies" ON public.escalation_policies FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER update_escalation_policies_updated_at BEFORE UPDATE ON public.escalation_policies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.escalation_levels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  policy_id UUID NOT NULL REFERENCES public.escalation_policies(id) ON DELETE CASCADE,
  level_order INTEGER NOT NULL DEFAULT 0,
  schedule_id UUID REFERENCES public.oncall_schedules(id) ON DELETE SET NULL,
  notify_method TEXT NOT NULL DEFAULT 'in_app',
  timeout_minutes INTEGER NOT NULL DEFAULT 15,
  contact_name TEXT,
  contact_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.escalation_levels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view levels of own policies" ON public.escalation_levels FOR SELECT USING (EXISTS (SELECT 1 FROM escalation_policies WHERE escalation_policies.id = escalation_levels.policy_id AND escalation_policies.user_id = auth.uid()));
CREATE POLICY "Users can insert levels to own policies" ON public.escalation_levels FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM escalation_policies WHERE escalation_policies.id = escalation_levels.policy_id AND escalation_policies.user_id = auth.uid()));
CREATE POLICY "Users can update levels of own policies" ON public.escalation_levels FOR UPDATE USING (EXISTS (SELECT 1 FROM escalation_policies WHERE escalation_policies.id = escalation_levels.policy_id AND escalation_policies.user_id = auth.uid()));
CREATE POLICY "Users can delete levels from own policies" ON public.escalation_levels FOR DELETE USING (EXISTS (SELECT 1 FROM escalation_policies WHERE escalation_policies.id = escalation_levels.policy_id AND escalation_policies.user_id = auth.uid()));

-- Public status page config
CREATE TABLE public.status_page_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  page_title TEXT NOT NULL DEFAULT 'System Status',
  page_description TEXT DEFAULT 'Current system status and incident updates',
  logo_url TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.status_page_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view enabled status pages" ON public.status_page_config FOR SELECT USING (enabled = true);
CREATE POLICY "Users can insert own config" ON public.status_page_config FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own config" ON public.status_page_config FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own config" ON public.status_page_config FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER update_status_page_config_updated_at BEFORE UPDATE ON public.status_page_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Public status page services (which services to show publicly)
CREATE TABLE public.status_page_services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  status_page_id UUID NOT NULL REFERENCES public.status_page_config(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.status_page_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view status page services" ON public.status_page_services FOR SELECT USING (EXISTS (SELECT 1 FROM status_page_config WHERE status_page_config.id = status_page_services.status_page_id AND status_page_config.enabled = true));
CREATE POLICY "Users can manage own status page services" ON public.status_page_services FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM status_page_config WHERE status_page_config.id = status_page_services.status_page_id AND status_page_config.user_id = auth.uid()));
CREATE POLICY "Users can update own status page services" ON public.status_page_services FOR UPDATE USING (EXISTS (SELECT 1 FROM status_page_config WHERE status_page_config.id = status_page_services.status_page_id AND status_page_config.user_id = auth.uid()));
CREATE POLICY "Users can delete own status page services" ON public.status_page_services FOR DELETE USING (EXISTS (SELECT 1 FROM status_page_config WHERE status_page_config.id = status_page_services.status_page_id AND status_page_config.user_id = auth.uid()));

-- Public incident updates for the status page
CREATE TABLE public.status_page_incidents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  status_page_id UUID NOT NULL REFERENCES public.status_page_config(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'investigating',
  severity TEXT NOT NULL DEFAULT 'warning',
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.status_page_incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view status page incidents" ON public.status_page_incidents FOR SELECT USING (EXISTS (SELECT 1 FROM status_page_config WHERE status_page_config.id = status_page_incidents.status_page_id AND status_page_config.enabled = true));
CREATE POLICY "Users can insert own incidents" ON public.status_page_incidents FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM status_page_config WHERE status_page_config.id = status_page_incidents.status_page_id AND status_page_config.user_id = auth.uid()));
CREATE POLICY "Users can update own incidents" ON public.status_page_incidents FOR UPDATE USING (EXISTS (SELECT 1 FROM status_page_config WHERE status_page_config.id = status_page_incidents.status_page_id AND status_page_config.user_id = auth.uid()));
CREATE POLICY "Users can delete own incidents" ON public.status_page_incidents FOR DELETE USING (EXISTS (SELECT 1 FROM status_page_config WHERE status_page_config.id = status_page_incidents.status_page_id AND status_page_config.user_id = auth.uid()));
CREATE TRIGGER update_status_page_incidents_updated_at BEFORE UPDATE ON public.status_page_incidents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
