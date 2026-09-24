// Thin wrapper over create_attendance_submission.
//
// NEW, alongside attendanceBackfillService.js rather than replacing it. That
// service and its RPC are untouched and still drive the Backfill wizard and
// the sidebar's Add Activity form, so backing this feature out is a component
// swap with no SQL to undo.
//
// Everything that decides whether the submission is allowed, what times each
// day gets, and whether it lands Pending or Approved is server-side in
// supabase/sql_editor/create_attendance_submission_rpc.sql. Nothing here
// interprets; it only shapes the call.
import { supabase } from "@/lib/supabaseClient";

/**
 * One employee, one attendance type, one reason, one photo, one note, across
 * a set of dates -- each with its own shape and times.
 *
 * `days` is [{ work_date, day_shape, clock_in_time, clock_out_time }].
 *
 * The photo must already be UPLOADED: pass the resulting url and path, never a
 * File. A File sent to PostgREST serializes to the string "{}" and destroys
 * the column -- which has happened in this codebase before, so it is worth
 * stating at every boundary where a File could be passed by mistake.
 *
 * Resolves to the RPC's own result, which unlike the backfill RPC includes the
 * created activity ids.
 */
export async function createAttendanceSubmission({
  employeeId,
  attendanceTypeId,
  adjustmentReasonId,
  days,
  notes = null,
  photoUrl = null,
  photoPath = null,
  allowLeaveConflict = false,
}) {
  const { data, error } = await supabase.rpc("create_attendance_submission", {
    p_employee_id: employeeId,
    p_attendance_type_id: attendanceTypeId,
    p_adjustment_reason_id: adjustmentReasonId,
    p_days: days,
    p_notes: notes,
    p_photo_url: photoUrl,
    p_photo_path: photoPath,
    p_allow_leave_conflict: allowLeaveConflict,
  });

  if (error) throw error;

  return data;
}
