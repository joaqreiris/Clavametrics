-- ============================================================
-- MIGRATION: Fix RLS policies for registration + auth flow
-- ============================================================
-- Run in Supabase Dashboard → SQL Editor BEFORE deploying
-- the auth code fixes (auth-callback.html, Register.html).
--
-- Root cause: clubs and profiles have RLS enabled but NO
-- INSERT policy, so every registration attempt is silently
-- denied → "Database error saving new user".
-- ============================================================

-- 1. Allow any authenticated user to INSERT a new club.
--    Used during registration (email/password and OAuth flows).
CREATE POLICY "Authenticated users can create clubs"
  ON public.clubs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- 2. Allow a user to INSERT their own profile row.
--    The WITH CHECK ensures they can only create their own row.
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- 3. Allow club admins to DELETE their own club.
--    Used by Register.html to clean up orphaned clubs on failure.
CREATE POLICY "Club admins can delete their club"
  ON public.clubs FOR DELETE
  USING (
    id = get_user_club_id()
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- 4. Allow users to UPDATE their own profile (needed for Onboarding
--    and Settings to save changes to full_name, avatar_url, etc.).
--    The existing policy only covers UPDATE via club_id check;
--    this one covers the simple "own row" case.
CREATE POLICY "Users can update own profile (self)"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ============================================================
-- VERIFICATION QUERIES (run after applying to confirm):
-- ============================================================
-- SELECT policyname, cmd, qual, with_check
--   FROM pg_policies
--  WHERE tablename IN ('clubs', 'profiles')
--  ORDER BY tablename, cmd;
