-- reject_attendance: mark one Pending attendance activity as Rejected, with a
-- mandatory written reason.
--
-- Run this once in the Supabase SQL editor. Re-runnable (CREATE OR REPLACE).
--
-- Hardened 2026-09-24 alongside approve_attendance: search_path = '' with
-- fully-qualified public.* names, and LIMIT 1 on the actor lookup. See that
-- file for why both matter.
--
-- DELIBERATELY DOES *NOT* FORBID SELF-REJECTION, unlike approve_attendance.
-- Segregation of duties exists to stop someone granting themselves a benefit,
-- not to stop them declining one. Rejecting your own row removes your own
-- hours -- it is an act against your own interest, so there is nothing to gain
-- by it. It is also the only way to retract a row at all: there is no
-- self-DELETE policy on attendance_activities by design, so withdrawing a
-- mistaken claim means rejecting it, which leaves the row and its stated
-- reason in place for the audit trail rather than erasing both.
CREATE OR REPLACE FUNCTION public.reject_attendance(activity_id uuid, reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_employee_id uuid;
  v_actor_id    uuid;
BEGIN
  IF reason IS NULL OR btrim(reason) = '' THEN
    RAISE EXCEPTION 'A rejection reason is required';
  END IF;

  SELECT employee_id INTO v_employee_id
  FROM public.attendance_activities
  WHERE id = activity_id;

  IF v_employee_id IS NULL THEN
    RAISE EXCEPTION 'Attendance activity % not found', activity_id;
  END IF;

  -- LIMIT 1: see approve_attendance.sql. Without it, two employees rows
  -- sharing one profile_id raise 21000 and block every rejection by that
  -- actor.
  SELECT id INTO v_actor_id
  FROM public.employees
  WHERE profile_id = auth.uid()
  LIMIT 1;

  -- Authorized: superadmin, OR HR department (matches the existing HR
  -- Attendance Management route gate, departments:["HR"], which lets any HR
  -- staff reject any employee's attendance company-wide), OR the target
  -- employee's direct manager (mirrors the "Only Managers can CRUD Team
  -- Attendance" RLS policy in attendance_activities_crud.sql).
  -- department_id 7 = HR (supabase/csv/departments_rows.csv).
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role_id = 3
  ) AND NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.department_id = 7
  ) AND NOT EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id = v_employee_id
      AND e.manager_id = v_actor_id
  ) THEN
    RAISE EXCEPTION 'Not authorized to reject this attendance activity';
  END IF;

  -- approved_by/approved_at double as "who actioned this, and when" for a
  -- rejection too -- the columns are named for the approve case but carry the
  -- reviewer either way, which is what the timeline card renders.
  --
  -- The `approval_status = 'Pending'` guard makes this idempotent: rejecting
  -- an already-actioned row is a no-op, so a double-click cannot overwrite an
  -- earlier reviewer's reason with a later one.
  UPDATE public.attendance_activities
  SET
    approval_status  = 'Rejected',
    rejection_reason = reason,
    approved_by      = v_actor_id,
    approved_at      = now()
  WHERE id = activity_id
    AND approval_status = 'Pending';
END;
$$;
