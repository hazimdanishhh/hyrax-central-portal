-- table: attendance_logs
-- function: auto_clock_out_app_on_scan
-- events: AFTER INSERT

-- 1. Create the automation function
CREATE OR REPLACE FUNCTION public.auto_clock_out_app_on_scan()
RETURNS TRIGGER AS $$
DECLARE
    emp_uuid UUID;
BEGIN
    -- Step 1: Look up the Employee's UUID using their Scanner ID
    SELECT id INTO emp_uuid FROM public.employees WHERE employee_id = NEW.employee_id LIMIT 1;

    -- Step 2: If we found the employee, close any open App sessions
    --
    -- Two guards added after a real race-condition review (vigilance_iot
    -- ingests in ~5-minute batches, so a scan can land in attendance_logs
    -- meaningfully later than the moment it actually happened):
    --   - clocked_in_at <= NEW.scanned_at: a scan whose real timestamp
    --     precedes the session's own clock-in can no longer close it --
    --     without this, a delayed/out-of-order scan could retroactively set
    --     clocked_out_at earlier than clocked_in_at, a negative-duration row.
    --   - NEW.scanned_at >= clocked_in_at + interval '5 minutes': a scan
    --     landing within 5 minutes of the clock-in is too close/ambiguous to
    --     confidently mean "they've now arrived on-site instead of remote",
    --     so it's ignored and the session stays open. The next real scan (at
    --     least 5 minutes later) or the end-of-day auto_clock_out() cutoff
    --     still closes it eventually -- nothing is ever left open forever.
    IF emp_uuid IS NOT NULL THEN
        UPDATE public.attendance_activities
        -- Set the clock-out time to match the exact moment they badged the door
        SET clocked_out_at = NEW.scanned_at
        WHERE employee_id = emp_uuid
          AND clocked_out_at IS NULL
          AND clocked_in_at <= NEW.scanned_at
          AND NEW.scanned_at >= clocked_in_at + interval '5 minutes';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Attach the trigger to the table
DROP TRIGGER IF EXISTS trigger_auto_clock_out ON public.attendance_logs;
CREATE TRIGGER trigger_auto_clock_out
AFTER INSERT ON public.attendance_logs
FOR EACH ROW
EXECUTE FUNCTION public.auto_clock_out_app_on_scan();