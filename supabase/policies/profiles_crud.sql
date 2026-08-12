-- Run this once in the Supabase SQL editor, AFTER
-- supabase/functions/is_superadmin.sql.
--
-- The original version of this file created "Superadmin CRUD" with an
-- inline `EXISTS (select 1 from profiles where ...)` -- the same pattern
-- superadmin_crud.sql already uses successfully on attendance_activities.
-- That works fine on a DIFFERENT table, but on profiles itself it causes
-- real, confirmed (2026-08) infinite recursion: checking the policy
-- re-queries profiles, which re-evaluates the same policy, forever
-- ("infinite recursion detected in policy for relation \"profiles\"").
-- Fixed by routing the check through is_superadmin() (SECURITY DEFINER,
-- breaks the cycle -- see that file for why). Uses `alter policy`, not
-- `create policy`, since the policy already exists from the first run.
alter policy "Superadmin CRUD"
on "public"."profiles"
to authenticated
using (
    public.is_superadmin()
) with check (
    public.is_superadmin()
);
