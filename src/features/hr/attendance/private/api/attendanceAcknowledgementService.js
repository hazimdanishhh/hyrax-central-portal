// Thin RPC wrappers -- the category-dependent authorization rule (an employee
// may close their own absence, but only HR may close an insufficient-half-day),
// the "is this day actually flagged" check, and the reason/notes validation all
// live server-side in supabase/sql_editor/acknowledge_attendance_day_rpc.sql.
import { supabase } from "@/lib/supabaseClient";

/**
 * Resolve a reconciliation flag so it stops being an open item.
 *
 * For category "absent" this DECLARES THE DAY UNPAID -- that is the whole
 * meaning of acknowledging an absence. It does not remove the day from
 * daysAbsentCount; payroll still deducts it. What clears is the review.
 */
export async function acknowledgeAttendanceDay({
  employeeId,
  workDate,
  category,
  reasonId,
  notes,
}) {
  const { data, error } = await supabase.rpc("acknowledge_attendance_day", {
    p_employee_id: employeeId,
    p_work_date: workDate,
    p_category: category,
    p_reason_id: reasonId,
    p_notes: notes || null,
  });

  if (error) throw error;

  return data;
}

/** HR/superadmin only -- re-opens a closed flag. */
export async function revokeAttendanceDayAcknowledgement({
  employeeId,
  workDate,
  category,
}) {
  const { data, error } = await supabase.rpc(
    "revoke_attendance_day_acknowledgement",
    {
      p_employee_id: employeeId,
      p_work_date: workDate,
      p_category: category,
    },
  );

  if (error) throw error;

  return data;
}

/** The reason vocabulary, scoped to one category via applicable_categories. */
export async function fetchAcknowledgementReasons() {
  const { data, error } = await supabase
    .from("attendance_acknowledgement_reasons")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");

  if (error) throw error;

  return data || [];
}

/**
 * Any acknowledgements already recorded for one employee-day. Drives the
 * "Absence acknowledged by X on <date>" panel and hides the Acknowledge button
 * once it has been used.
 */
export async function fetchDayAcknowledgements({ employeeId, workDate }) {
  if (!employeeId || !workDate) return [];

  const { data, error } = await supabase
    .from("attendance_reconciliation_acknowledgements")
    .select(
      "*, reason:reason_id(code, label), acknowledged_by_employee:acknowledged_by(full_name)",
    )
    .eq("employee_id", employeeId)
    .eq("work_date", workDate);

  if (error) throw error;

  return data || [];
}
