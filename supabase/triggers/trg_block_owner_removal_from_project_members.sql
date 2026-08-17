-- Named to fire before trg_block_project_member_removal_with_active_tasks
-- ("block_o" < "block_p" -- Postgres fires same-timing triggers
-- alphabetically by name), so if a row is BOTH the owner AND has active
-- tasks, the more fundamental "transfer ownership first" message is what
-- the caller sees.
create trigger trg_block_owner_removal_from_project_members
before delete on public.project_members
for each row execute function public.block_owner_removal_from_project_members();
