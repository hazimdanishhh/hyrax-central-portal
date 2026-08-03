CREATE OR REPLACE FUNCTION reject_attendance(activity_id uuid, reason text)
RETURNS void AS $$
DECLARE
  v_employee_id uuid;
BEGIN
  IF reason IS NULL OR btrim(reason) = '' THEN
    RAISE EXCEPTION 'A rejection reason is required';
  END IF;

  SELECT employee_id INTO v_employee_id
  FROM attendance_activities
  WHERE id = activity_id;

  IF v_employee_id IS NULL THEN
    RAISE EXCEPTION 'Attendance activity % not found', activity_id;
  END IF;

  -- Authorized: superadmin, OR HR department (matches the existing HR
  -- Attendance Management route gate, departments:["HR"], which lets any HR
  -- staff reject any employee's attendance company-wide), OR the target
  -- employee's direct manager (mirrors manager_crud.sql's RLS check).
  -- department_id 7 = HR (supabase/csv/departments_rows.csv).
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role_id = 3
  ) AND NOT EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.department_id = 7
  ) AND NOT EXISTS (
    SELECT 1 FROM employees e
    WHERE e.id = v_employee_id
      AND e.manager_id = (SELECT id FROM employees WHERE profile_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Not authorized to reject this attendance activity';
  END IF;

  UPDATE attendance_activities
  SET
    approval_status = 'Rejected',
    rejection_reason = reason,
    approved_by = (
      SELECT id FROM employees WHERE profile_id = auth.uid()
    ),
    approved_at = now()
  WHERE id = activity_id
    AND approval_status = 'Pending';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
