-- SELECT: HR and IT both see every item on every case, regardless of which
-- department owns a given item -- "visible but inert" for the department
-- that doesn't own it, the same ProjectTasksTab.jsx non-assignee pattern.
-- The employee sees only employee_visible items on their own
-- employee_can_view case -- the two-layer visibility gate from the
-- architecture doc.
--
-- UPDATE: only the item's owning department can write it (or superadmin,
-- via the blanket policy) -- owning_department_sub is not null and
-- is_department(owning_department_sub); a null owning_department_sub
-- (role_department_assigned, superadmin-only) means no department can
-- write it at all through this policy, matching that item's intended
-- "superadmin only" ownership. Derived items are only ever flipped by the
-- sync_lifecycle_item_on_* triggers (SECURITY DEFINER, bypass this policy
-- entirely), so this UPDATE policy in practice only gates the manual items.
--
-- No client INSERT/DELETE policy -- items are only ever seeded by
-- get_or_create_onboarding_case()/get_or_create_offboarding_case()
-- (SECURITY DEFINER), never directly by a user's own session.
create policy "Superadmin CRUD" on public.employee_lifecycle_case_items
to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());

create policy "HR and IT can view all lifecycle case items" on public.employee_lifecycle_case_items
for select to authenticated
using (public.is_department('HR') or public.is_department('IT'));

create policy "Employee can view own visible items" on public.employee_lifecycle_case_items
for select to authenticated
using (
    employee_visible = true
    and exists (
        select 1 from public.employee_lifecycle_cases c
        where c.id = case_id
          and c.employee_id = public.current_employee_id()
          and c.employee_can_view = true
    )
);

create policy "Owning department can update their items" on public.employee_lifecycle_case_items
for update to authenticated
using (owning_department_sub is not null and public.is_department(owning_department_sub))
with check (owning_department_sub is not null and public.is_department(owning_department_sub));
