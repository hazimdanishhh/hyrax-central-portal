create or replace trigger trg_notify_profile_created
after insert on public.profiles
for each row
execute function public.notify_profile_created();
