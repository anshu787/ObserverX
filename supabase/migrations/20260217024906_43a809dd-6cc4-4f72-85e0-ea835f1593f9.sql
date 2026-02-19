
-- On-call overrides: manually assign a member for a specific date
CREATE TABLE public.oncall_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  schedule_id UUID NOT NULL REFERENCES public.oncall_schedules(id) ON DELETE CASCADE,
  override_date DATE NOT NULL,
  member_id UUID NOT NULL REFERENCES public.oncall_members(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Unique constraint: one override per schedule per date
ALTER TABLE public.oncall_overrides ADD CONSTRAINT oncall_overrides_schedule_date_unique UNIQUE (schedule_id, override_date);

-- Enable RLS
ALTER TABLE public.oncall_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own overrides"
  ON public.oncall_overrides FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own overrides"
  ON public.oncall_overrides FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own overrides"
  ON public.oncall_overrides FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own overrides"
  ON public.oncall_overrides FOR DELETE
  USING (auth.uid() = user_id);
