-- Template for creating policies for a table in Supabase
-- Replace {table_name} with the name of the table you want to create policies for.
-- Replace the role_id and department_id values in the policies with the appropriate values for your use case.
-- ../csv has departments_rows.csv and roles_rows.csv for reference. Should be updated accordingly to the current state of the database.

-- Role specific CRUD

create policy "Superadmin CRUD" on public.{table_name}
to authenticated
using (
  exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role_id = 3)
) with check (
  exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role_id = 3)
);

-- Role and department specific CRUD

create policy "Sales Manager CRUD" on public.{table_name}
to authenticated
using (
  (EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role_id = 2) AND (profiles.department_id = 3))))
) with check (
  (EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role_id = 2) AND (profiles.department_id = 3))))
);

-- Department specific CRUD

create policy "Sales Department CRUD" on public.{table_name}
to authenticated
using (
  exists (select 1 from profiles where profiles.id = auth.uid() and profiles.department_id = 3)
) with check (
  exists (select 1 from profiles where profiles.id = auth.uid() and profiles.department_id = 3)
);

-- Department specific READ

create policy "Sales Department VIEW" on public.employee_sales_rep_mapping as PERMISSIVE
for SELECT
to authenticated
using (
  exists (select 1 from profiles where profiles.id = auth.uid() and profiles.department_id = 3)
);