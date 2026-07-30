CREATE OR REPLACE FUNCTION reject_attendance(activity_id uuid, reason text)
RETURNS void AS $$
BEGIN
  UPDATE attendance_activities
  SET 
    approval_status = 'Rejected',
    rejection_reason = reason,
    approved_by = (
      SELECT id FROM employees WHERE profile_id = auth.uid()
    ),
    approved_at = now()
  WHERE id = activity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;