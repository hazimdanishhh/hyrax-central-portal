alter policy "Manager CRUD"
on "public"."attendance_activities"
to authenticated
using (
    (EXISTS ( SELECT 1 FROM employees e WHERE ((e.id = attendance_activities.employee_id) AND (e.manager_id = ( SELECT employees.id FROM employees WHERE (employees.profile_id = auth.uid()))))))
) with check (
    (EXISTS ( SELECT 1 FROM employees e WHERE ((e.id = attendance_activities.employee_id) AND (e.manager_id = ( SELECT employees.id FROM employees WHERE (employees.profile_id = auth.uid()))))))
);