-- Fix for profile deletion
-- This migration updates all foreign key constraints pointing to public.profiles
-- to use ON DELETE CASCADE or ON DELETE SET NULL as appropriate.

BEGIN;

-- Drop existing constraints
ALTER TABLE public.checkins DROP CONSTRAINT IF EXISTS checkins_user_id_fkey;
ALTER TABLE public.checkin_results DROP CONSTRAINT IF EXISTS checkin_results_user_id_fkey;
ALTER TABLE public.objectives DROP CONSTRAINT IF EXISTS objectives_user_id_fkey;
ALTER TABLE public.objectives DROP CONSTRAINT IF EXISTS objectives_created_by_fkey;
ALTER TABLE public.key_results DROP CONSTRAINT IF EXISTS key_results_user_id_fkey;
ALTER TABLE public.key_results DROP CONSTRAINT IF EXISTS key_results_created_by_fkey;
ALTER TABLE public.company_members DROP CONSTRAINT IF EXISTS company_members_user_id_fkey;
ALTER TABLE public.quarter_checkins DROP CONSTRAINT IF EXISTS quarter_checkins_user_id_fkey;
ALTER TABLE public.quarters DROP CONSTRAINT IF EXISTS quarters_created_by_fkey;

-- Re-add with CASCADE/SET NULL
ALTER TABLE public.checkins 
  ADD CONSTRAINT checkins_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) 
  ON DELETE CASCADE;

ALTER TABLE public.checkin_results 
  ADD CONSTRAINT checkin_results_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) 
  ON DELETE CASCADE;

ALTER TABLE public.objectives 
  ADD CONSTRAINT objectives_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) 
  ON DELETE CASCADE;

ALTER TABLE public.objectives 
  ADD CONSTRAINT objectives_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) 
  ON DELETE SET NULL;

ALTER TABLE public.key_results 
  ADD CONSTRAINT key_results_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) 
  ON DELETE CASCADE;

ALTER TABLE public.key_results 
  ADD CONSTRAINT key_results_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) 
  ON DELETE SET NULL;

ALTER TABLE public.company_members 
  ADD CONSTRAINT company_members_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) 
  ON DELETE CASCADE;

ALTER TABLE public.quarter_checkins 
  ADD CONSTRAINT quarter_checkins_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) 
  ON DELETE CASCADE;

ALTER TABLE public.quarters 
  ADD CONSTRAINT quarters_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) 
  ON DELETE SET NULL;

COMMIT;
