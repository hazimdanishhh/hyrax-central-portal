-- Run this once in the Supabase SQL editor.
--
-- Confirmed live via a full pg_policies audit (2026-09): addresses has RLS
-- enabled with ZERO policies -- no one but the service-role connection can
-- read/write it via the API. work_locations_addresses_migration.sql created
-- the table but never added a policy for it.
--
-- Impact confirmed: employeeMutations.js's resolvePersonalAddressFields(),
-- called from updateEmployee()/createEmployee(), does a direct
-- supabase.from("addresses").update()/.insert() -- the real save path for
-- the Employee Management form's "Address Information" section. Any HR user
-- saving/creating an employee's personal address gets a permission-denied
-- error today. (Reads already work fine -- employees_public_view.sql joins
-- addresses from inside a view that bypasses RLS as its owner -- this is a
-- write-only gap.)
--
-- Same shape as the employees table's own policy set (self view/HR CRUD/
-- superadmin CRUD) -- addresses is 1:1 with an employee's
-- personal_address_id, edited only through the HR Employee Management form
-- today. Self-view has no current frontend consumer (self-service reads
-- already go through employees_public, which bypasses RLS as a view owner),
-- but is added for consistency with employees' own self-view convention and
-- to cover any future self-service page that queries addresses directly.
--
-- Idempotent: safe to re-run.

drop policy if exists "Enable users to view their own data only" on public.addresses;
create policy "Enable users to view their own data only" on public.addresses
for select to authenticated
using (
  id in (
    select personal_address_id from employees where employees.profile_id = auth.uid()
  )
);

drop policy if exists "HR CRUD" on public.addresses;
create policy "HR CRUD" on public.addresses
to authenticated
using (
  exists (
    select 1 from profiles p
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and d.sub = 'HR'
  )
) with check (
  exists (
    select 1 from profiles p
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and d.sub = 'HR'
  )
);

drop policy if exists "Superadmin CRUD" on public.addresses;
create policy "Superadmin CRUD" on public.addresses
to authenticated
using (
  exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role_id = 3)
) with check (
  exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role_id = 3)
);
