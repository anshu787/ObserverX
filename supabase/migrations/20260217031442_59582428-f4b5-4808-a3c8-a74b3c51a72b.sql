
-- Audit log for tracking admin actions
CREATE TABLE public.audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Admins can view all audit logs
CREATE POLICY "Admins can view all audit logs"
ON public.audit_log FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Any authenticated user can insert (edge functions insert on behalf of users)
CREATE POLICY "Authenticated users can insert audit logs"
ON public.audit_log FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Rate limiting table for API key generation
CREATE TABLE public.rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Only service role accesses this table (no user policies needed)
-- Create index for efficient rate limit queries
CREATE INDEX idx_rate_limits_user_action ON public.rate_limits (user_id, action, created_at DESC);
CREATE INDEX idx_audit_log_created_at ON public.audit_log (created_at DESC);
CREATE INDEX idx_audit_log_user_id ON public.audit_log (user_id, created_at DESC);
