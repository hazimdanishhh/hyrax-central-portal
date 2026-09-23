// Thin RPC wrappers -- which categories may be acknowledged, who may do it,
// the "is this day actually flagged" check, and the reason/notes validation all
// live server-side in supabase/sql_editor/acknowledge_attendance_day_rpc.sql.
import { supabase } from "@/lib/supabaseClient";

/**
 * Resolve a reconciliation flag so it stops being an open item.
 *
 * ONLY "insufficient_half_day" is accepted, and only from HR or a superadmin.
 * Passing "absent" is rejected by the RPC with a hint pointing at HR2000 --
 * absence acknowledgement was removed on 2026-09-23, since every unexcused
 * absence ends up there as NPL and the next leave sync clears the day on its
 * own. `category` remains a parameter because the acknowledgement table is
 * keyed on (employee, date, category).
 *
 * Acknowledging closes the REVIEW, not the fact: the hours stay as recorded
 * and the period totals are unchanged.
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
 * "Short half-day hours acknowledged by X on <date>" panel and hides the
 * Acknowledge button once it has been used. Still returns rows of any
 * category, including pre-2026-09-23 absences, so an old one stays visible and
 * revocable rather than silently disappearing.
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
