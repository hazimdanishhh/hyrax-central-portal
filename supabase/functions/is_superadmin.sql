-- Run this once in the Supabase SQL editor, BEFORE the alter policy
-- statements in profiles_crud.sql / avatars_bucket_setup.sql that use it.
--
-- Shared "is the current user a superadmin" check, safe to use in a policy
-- defined on the profiles table itself. A plain inline
-- `EXISTS (select 1 from profiles where ...)` inside a policy ON profiles
-- causes "infinite recursion detected in policy for relation \"profiles\"" --
-- checking the policy re-queries profiles, which re-evaluates the same
-- policy, forever. Wrapping the check in a SECURITY DEFINER function breaks
-- the cycle, because the function's *inner* query runs as its owning role
-- (postgres, via the SQL editor -- which has BYPASSRLS), not as the calling
-- user, so it never re-triggers the calling policy.
--
-- Must be `language plpgsql`, not `language sql` -- Postgres inlines simple
-- SQL-language functions into the calling query during planning, which
-- silently discards the SECURITY DEFINER context and brings the recursion
-- right back. plpgsql functions are never inlined.
--
-- `set search_path = ''` + fully-qualified `public.profiles`: standard
-- hardening for SECURITY DEFINER functions, so a malicious search_path set
-- by the caller can't redirect an unqualified table reference elsewhere.
create or replace function public.is_superadmin()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  return exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role_id = 3
  );
end;
$$;
