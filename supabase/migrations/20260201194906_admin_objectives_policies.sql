-- Allow admins to manage objectives regardless of company membership
CREATE POLICY IF NOT EXISTS "Admins can manage objectives" ON public.objectives
FOR ALL
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Allow admins to manage key_results regardless of company membership
CREATE POLICY IF NOT EXISTS "Admins can manage key_results" ON public.key_results
FOR ALL
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));