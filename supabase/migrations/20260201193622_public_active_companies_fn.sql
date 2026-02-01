-- Helper function to list active companies for public/signup dropdown
CREATE OR REPLACE FUNCTION public.public_active_companies()
RETURNS TABLE(id uuid, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, name
  FROM public.companies
  WHERE coalesce(is_active, true) = true;
$$;

GRANT EXECUTE ON FUNCTION public.public_active_companies() TO anon, authenticated;