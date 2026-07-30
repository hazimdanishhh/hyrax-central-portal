-- also used in the cron job to auto clock out employees at 11:59 PM everyday for attendance that aren't clocked out yet (only for app attendance, not for physical scanner attendance)

CREATE OR REPLACE FUNCTION auto_clock_out()
RETURNS void AS $$
BEGIN
  UPDATE attendance_activities
  SET clocked_out_at = now()
  WHERE clocked_out_at IS NULL
  AND clocked_in_at::date = now()::date;
END;
$$ LANGUAGE plpgsql;