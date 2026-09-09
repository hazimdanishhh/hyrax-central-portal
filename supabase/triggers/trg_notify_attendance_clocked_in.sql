-- Run this once in the Supabase SQL editor, AFTER
-- notify_attendance_clocked_in.sql has been created.
create trigger trg_notify_attendance_clocked_in
after insert on public.attendance_activities
for each row execute function public.notify_attendance_clocked_in();
