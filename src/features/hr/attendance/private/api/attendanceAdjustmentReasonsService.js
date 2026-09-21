import { supabase } from "@/lib/supabaseClient";

/**
 * The constrained "why was this entered by hand" vocabulary shown in the
 * backfill wizard's reason picker.
 *
 * `description` is fetched and displayed as helper text under the picker --
 * that is the whole reason this is a table rather than a CHECK constraint (see
 * supabase/sql_editor/attendance_adjustment_reasons_migration.sql), mirroring
 * how PayrollReconciliationSidebar renders payroll_reconciliation_glossary.
 * Keeping the wording server-side means the form, and anything else that ever
 * explains these codes, can't drift apart.
 */
export async function fetchAttendanceAdjustmentReasons() {
  const { data, error } = await supabase
    .from("attendance_adjustment_reasons")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");

  if (error) throw error;

  return data || [];
}
