-- SELECT: HR and IT both see every case regardless of type (one unified
-- case, filtered per viewer in the UI/item ownership, not per table row --
-- see docs/EMPLOYEE-LIFECYCLE-CHECKLIST-ARCHITECTURE.md's "one unified
-- case, not separate HR/IT checklists"). The employee sees only their own
-- case, and only once HR has explicitly flipped employee_can_view -- an
-- offboarding case can legitimately exist internally before that
-- conversation has happened.
--
-- UPDATE: HR only (plus superadmin via the blanket policy) -- the "Manual
-- status override" design: employee_lifecycle_cases.status/expected_last_day/
-- employee_can_view are plain editable fields, following the projects.status
-- precedent, but narrower than that precedent's "any elevated member" since
-- this field also drives notification/visibility behavior and IT owns
-- individual items, not the case shell.
--
-- No client INSERT/DELETE policy at all -- cases are only ever created by
-- get_or_create_onboarding_case()/get_or_create_offboarding_case()
-- (SECURITY DEFINER, bypass RLS for the write), never directly by a user's
-- own session, matching the notifications table's own "no client INSERT
-- policy" precedent.
create policy "Superadmin CRUD" on public.employee_lifecycle_cases
to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());

create policy "HR and IT can view all lifecycle cases" on public.employee_lifecycle_cases
for select to authenticated
using (public.is_department('HR') or public.is_department('IT'));

create policy "Employee can view own visible case" on public.employee_lifecycle_cases
for select to authenticated
using (employee_id = public.current_employee_id() and employee_can_view = true);

create policy "HR can update lifecycle cases" on public.employee_lifecycle_cases
for update to authenticated
using (public.is_department('HR'))
with check (public.is_department('HR'));
