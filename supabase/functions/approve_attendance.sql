-- approve_attendance: mark one Pending attendance activity as Approved.
--
-- Run this once in the Supabase SQL editor. Re-runnable (CREATE OR REPLACE).
--
-- Hardened 2026-09-24, three changes, all described where they occur:
--   1. self-approval is now forbidden
--   2. search_path = '' with fully-qualified public.* names
--   3. LIMIT 1 on the actor lookup
--
-- security definer + set search_path = '' + fully-qualified public.* names:
-- this function previously used `SET search_path = public` with unqualified
-- table names, unlike every other SECURITY DEFINER function in this schema
-- (acknowledge_attendance_day_rpc.sql, create_attendance_backfill_rpc.sql,
-- deactivate_profile.sql). An empty search_path plus explicit schemas is the
-- standard because it removes any possibility of a same-named object earlier
-- on the path being resolved instead.
CREATE OR REPLACE FUNCTION public.approve_attendance(activity_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_employee_id uuid;
  v_actor_id    uuid;
BEGIN
  SELECT employee_id INTO v_employee_id
  FROM public.attendance_activities
  WHERE id = activity_id;

  IF v_employee_id IS NULL THEN
    RAISE EXCEPTION 'Attendance activity % not found', activity_id;
  END IF;

  -- LIMIT 1: without it, two employees rows sharing one profile_id raise
  -- 21000 (more than one row returned by a subquery) and block ALL approvals
  -- for that actor, with an error that says nothing about the real cause.
  SELECT id INTO v_actor_id
  FROM public.employees
  WHERE profile_id = auth.uid()
  LIMIT 1;

  -- SEGREGATION OF DUTIES. Added 2026-09-24.
  --
  -- create_attendance_backfill_rpc.sql:508 already relies on this being true
  -- -- "approve_attendance already forbids approving your own record" -- and
  -- it was not. Any HR-department employee could approve their own Pending
  -- self-reconciliation row through the ordinary UI, which makes the whole
  -- Pending -> Approved step self-service for exactly the people whose hours
  -- nobody else checks.
  --
  -- Checked BEFORE the authorization branch below on purpose: being HR or a
  -- manager is what would otherwise grant the power, so the exception must not
  -- be reachable by holding a stronger role.
  IF v_employee_id = v_actor_id THEN
    RAISE EXCEPTION 'You cannot approve your own attendance'
      USING HINT = 'Ask another HR user, or the employee''s manager, to review it.';
  END IF;

  -- Authorized: superadmin, OR HR department (matches the existing HR
  -- Attendance Management route gate, departments:["HR"], which lets any HR
  -- staff approve any employee's attendance company-wide), OR the target
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
    RAISE EXCEPTION 'Not authorized to approve this attendance activity';
  END IF;

  -- The `approval_status = 'Pending'` guard makes this idempotent: approving
  -- an already-Approved row is a no-op rather than re-stamping approved_at,
  -- so a double-click cannot rewrite who approved it or when.
  UPDATE public.attendance_activities
  SET
    approval_status = 'Approved',
    approved_by = v_actor_id,
    approved_at = now()
  WHERE id = activity_id
    AND approval_status = 'Pending';
END;
$$;
