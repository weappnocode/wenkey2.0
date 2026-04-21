-- Add manager_id to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Objectives Policy
DROP POLICY IF EXISTS "Managers can view all objectives in their companies" ON public.objectives;
CREATE POLICY "Managers and Admins can view objectives"
  ON public.objectives FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.permission_type = 'admin'
    ) OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = objectives.user_id 
        AND p.manager_id = auth.uid()
        AND p.permission_type != 'admin'
    )
  );

-- Key Results Policy
DROP POLICY IF EXISTS "Managers can view all key results in their companies" ON public.key_results;
CREATE POLICY "Managers and Admins can view key results"
  ON public.key_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.permission_type = 'admin'
    ) OR EXISTS (
      SELECT 1 FROM public.objectives o
      JOIN public.profiles p ON p.id = o.user_id
      WHERE o.id = key_results.objective_id AND p.manager_id = auth.uid()
      AND p.permission_type != 'admin'
    )
  );

-- Checkin Results Policy
DROP POLICY IF EXISTS "Managers and admins can manage all checkin_results" ON public.checkin_results;
CREATE POLICY "Managers and admins can manage all checkin_results"
  ON public.checkin_results FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.permission_type = 'admin'
    ) OR EXISTS (
      SELECT 1 FROM public.key_results kr
      JOIN public.objectives o ON o.id = kr.objective_id
      JOIN public.profiles p ON p.id = o.user_id
      WHERE kr.id = checkin_results.key_result_id AND p.manager_id = auth.uid()
      AND p.permission_type != 'admin'
    )
  );
