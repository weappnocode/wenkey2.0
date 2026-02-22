-- Fix RLS policies for objectives table
-- Allows admin to insert/update/delete objectives for any user
-- Regular users can only operate on their own objectives

-- ============================================================
-- INSERT: admin can create objectives for any user
-- ============================================================
DROP POLICY IF EXISTS "Users can insert own objectives" ON objectives;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON objectives;
DROP POLICY IF EXISTS "objectives_insert_policy" ON objectives;
DROP POLICY IF EXISTS "objectives_insert_admin_or_self" ON objectives;

CREATE POLICY "objectives_insert_admin_or_self"
ON objectives FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.permission_type = 'admin'
  )
);

-- ============================================================
-- SELECT: admin sees all, user sees own
-- ============================================================
DROP POLICY IF EXISTS "Users can view own objectives" ON objectives;
DROP POLICY IF EXISTS "Enable read access for all users" ON objectives;
DROP POLICY IF EXISTS "objectives_select_policy" ON objectives;
DROP POLICY IF EXISTS "objectives_select_admin_or_own" ON objectives;

CREATE POLICY "objectives_select_admin_or_own"
ON objectives FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.permission_type = 'admin'
  )
);

-- ============================================================
-- UPDATE: admin can update any, user updates own
-- ============================================================
DROP POLICY IF EXISTS "Users can update own objectives" ON objectives;
DROP POLICY IF EXISTS "objectives_update_policy" ON objectives;
DROP POLICY IF EXISTS "objectives_update_admin_or_own" ON objectives;

CREATE POLICY "objectives_update_admin_or_own"
ON objectives FOR UPDATE TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.permission_type = 'admin'
  )
);

-- ============================================================
-- DELETE: admin can delete any, user deletes own
-- ============================================================
DROP POLICY IF EXISTS "Users can delete own objectives" ON objectives;
DROP POLICY IF EXISTS "objectives_delete_policy" ON objectives;
DROP POLICY IF EXISTS "objectives_delete_admin_or_own" ON objectives;

CREATE POLICY "objectives_delete_admin_or_own"
ON objectives FOR DELETE TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.permission_type = 'admin'
  )
);

-- ============================================================
-- key_results: same admin access pattern
-- ============================================================
DROP POLICY IF EXISTS "Users can insert key_results" ON key_results;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON key_results;
DROP POLICY IF EXISTS "kr_insert_admin_or_self" ON key_results;

CREATE POLICY "kr_insert_admin_or_self"
ON key_results FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.permission_type = 'admin'
  )
);

DROP POLICY IF EXISTS "Users can view key_results" ON key_results;
DROP POLICY IF EXISTS "Enable read access for key_results" ON key_results;
DROP POLICY IF EXISTS "kr_select_admin_or_own" ON key_results;

CREATE POLICY "kr_select_admin_or_own"
ON key_results FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.permission_type = 'admin'
  )
);

DROP POLICY IF EXISTS "Users can update own key_results" ON key_results;
DROP POLICY IF EXISTS "kr_update_admin_or_own" ON key_results;

CREATE POLICY "kr_update_admin_or_own"
ON key_results FOR UPDATE TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.permission_type = 'admin'
  )
);

DROP POLICY IF EXISTS "Users can delete own key_results" ON key_results;
DROP POLICY IF EXISTS "kr_delete_admin_or_own" ON key_results;

CREATE POLICY "kr_delete_admin_or_own"
ON key_results FOR DELETE TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.permission_type = 'admin'
  )
);
