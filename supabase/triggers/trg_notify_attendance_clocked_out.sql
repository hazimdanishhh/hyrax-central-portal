-- Run this once in the Supabase SQL editor, AFTER
-- notify_attendance_clocked_out.sql has been created.
create trigger trg_notify_attendance_clocked_out
after update on public.attendance_activities
for each row
when (old.clocked_out_at is null and new.clocked_out_at is not null)
execute function public.notify_attendance_clocked_out();
