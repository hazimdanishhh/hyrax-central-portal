// Thin RPC wrappers -- every rule that decides whether an attendance row may
// be created (authorization, overlap/double-count guards, leave conflicts,
// timestamp composition in MYT) lives server-side in
// supabase/sql_editor/create_attendance_backfill_rpc.sql. Nothing here
// validates anything, deliberately: the same wizard is reachable by HR, by a
// manager and by an employee, and a client-side check would be three different
// opportunities to disagree with the server.
import { supabase } from "@/lib/supabaseClient";

/**
 * Per-(employee, date) context used to pick sensible defaults BEFORE anything
 * is written: the employee's shift end time, whether the date is a
 * weekend/holiday/leave day, and any real scan already on record that day.
 *
 * A date the caller asked for that comes back with NO row is meaningful, not
 * an error: it means that date isn't in unified_daily_attendance's spine at
 * all (no company-wide activity, and not a weekend or public holiday). Adding
 * attendance there will pull the date into the spine and generate a row for
 * every active employee. The wizard surfaces that as a warning.
 */
export async function fetchAttendanceBackfillPrefill({ employeeIds, dates }) {
  if (!employeeIds?.length || !dates?.length) return [];

  const { data, error } = await supabase.rpc(
    "get_attendance_backfill_prefill",
    { p_employee_ids: employeeIds, p_dates: dates },
  );

  if (error) throw error;

  return data || [];
}

/**
 * Dry run -- returns the per-row add/skip decision table without writing.
 */
export async function previewAttendanceBackfill({ rows, allowLeaveConflict }) {
  const { data, error } = await supabase.rpc("create_attendance_backfill", {
    p_rows: rows,
    p_dry_run: true,
    p_allow_leave_conflict: !!allowLeaveConflict,
  });

  if (error) throw error;

  return data;
}

/**
 * Commit. Same payload as the preview, so what HR reviewed is exactly what
 * gets evaluated again server-side.
 */
export async function commitAttendanceBackfill({ rows, allowLeaveConflict }) {
  const { data, error } = await supabase.rpc("create_attendance_backfill", {
    p_rows: rows,
    p_dry_run: false,
    p_allow_leave_conflict: !!allowLeaveConflict,
  });

  if (error) throw error;

  return data;
}
