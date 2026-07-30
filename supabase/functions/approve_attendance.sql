CREATE OR REPLACE FUNCTION approve_attendance(activity_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE attendance_activities
  SET 
    approval_status = 'Approved',
    approved_by = (
      SELECT id FROM employees WHERE profile_id = auth.uid()
    ),
    approved_at = now()
  WHERE id = activity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;