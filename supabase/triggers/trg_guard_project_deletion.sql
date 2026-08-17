-- BEFORE DELETE on the PARENT fires -- and can abort the whole operation,
-- including the tasks.project_id ON DELETE CASCADE that would otherwise
-- follow -- before any child rows are removed. Postgres guarantees this
-- ordering (a BEFORE ROW trigger on the referenced row runs before an
-- FK's ON DELETE CASCADE action against referencing rows).
create trigger trg_guard_project_deletion
before delete on public.projects
for each row execute function public.guard_project_deletion();
