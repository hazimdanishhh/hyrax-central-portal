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
    IF emp_uuid IS NOT NULL THEN
        UPDATE public.attendance_activities
        -- Set the clock-out time to match the exact moment they badged the door
        SET clocked_out_at = NEW.scanned_at
        WHERE employee_id = emp_uuid 
          AND clocked_out_at IS NULL;
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