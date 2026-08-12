-- Run this once in the Supabase SQL editor, AFTER
-- supabase/functions/is_superadmin.sql.
--
-- The "avatars" bucket already exists (public, confirmed) with a
-- "profiles/" folder, filename = the profile's id, no extension -- e.g.
-- profiles/550e8400-e29b-41d4-a716-446655440000. Nothing to create here;
-- this file only adds the write policy, which didn't exist before (no
-- storage policy for this bucket was tracked anywhere in this repo).
--
-- Public bucket: reads need no policy -- a public bucket serves objects via
-- a stable public URL regardless of RLS. Writes are still access-controlled
-- below.
--
-- Uses public.is_superadmin() rather than repeating the inline
-- `EXISTS (select 1 from profiles where ...)` check inline -- this policy
-- is on storage.objects, not profiles, so the inline form wasn't actually
-- recursive here (that bug is specific to a policy defined ON profiles
-- itself, see profiles_crud.sql) -- but reusing the one vetted, centrally
-- defined check instead of a second hand-copied one avoids relying on two
-- separately-maintained versions of the same "is this a superadmin" logic
-- staying in sync. If you already ran the original inline version
-- successfully, this ALTER just swaps the check in place.
alter policy "Avatars: own file or superadmin"
on storage.objects
to authenticated
using (
    bucket_id = 'avatars'
    and (
        (storage.foldername(name))[1] = 'profiles'
        and (
            storage.filename(name) = auth.uid()::text
            or public.is_superadmin()
        )
    )
) with check (
    bucket_id = 'avatars'
    and (
        (storage.foldername(name))[1] = 'profiles'
        and (
            storage.filename(name) = auth.uid()::text
            or public.is_superadmin()
        )
    )
);
