-- Allow public select of active companies for signup dropdown
CREATE POLICY IF NOT EXISTS "Public can view active companies list" ON public.companies
FOR SELECT
TO anon
USING (is_active = true);

CREATE POLICY IF NOT EXISTS "Authenticated can view active companies list" ON public.companies
FOR SELECT
TO authenticated
USING (is_active = true);