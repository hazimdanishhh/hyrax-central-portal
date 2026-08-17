create or replace trigger trg_notify_profile_updated
after update on public.profiles
for each row
execute function public.notify_profile_updated();
