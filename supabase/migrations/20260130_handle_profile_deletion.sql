-- Create function to handle user deletion from auth.users when profiles are deleted
CREATE OR REPLACE FUNCTION public.handle_profile_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete the corresponding auth.users record
  DELETE FROM auth.users
  WHERE id = OLD.id;
  
  RETURN OLD;
END;
$$;

-- Create trigger to execute the function before profile deletion
DROP TRIGGER IF EXISTS on_profile_delete ON public.profiles;
CREATE TRIGGER on_profile_delete
  BEFORE DELETE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_profile_delete();
