-- Shared taxonomy, no confidentiality concerns: anyone reads, anyone can
-- add a new one on the fly (per the product owner's requirement) via
-- get_or_create_project_category(). Rename/delete restricted to
-- superadmin -- editing a shared tag affects every project using it.
create policy "Superadmin CRUD" on public.project_categories to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());

create policy "Anyone can view categories" on public.project_categories
  for select to authenticated using (true);

create policy "Anyone can add categories" on public.project_categories
  for insert to authenticated with check (true);
