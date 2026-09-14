// features/hr/payroll/private/api/payrollReconciliationEmailSendsService.js
import { supabase } from "../../../../../lib/supabaseClient";

/**
 * Most recent queue_payroll_reconciliation_email() call for this
 * employee+period, so PayrollReconciliationSidebar.jsx can show
 * "Last requested: <date> by <HR user>" instead of leaving HR guessing
 * whether they already sent this.
 *
 * `queuedByEmployee:employees!queued_by(full_name)` -- the explicit FK hint
 * is required, not stylistic: payroll_reconciliation_email_sends has two
 * separate uuid FKs into employees (employee_id, queued_by), and PostgREST
 * needs the FK column named to know which one to embed.
 */
export async function fetchLastPayrollReconciliationEmailSend({
  employeeUuid,
  startDate,
  endDate,
}) {
  const { data, error } = await supabase
    .from("payroll_reconciliation_email_sends")
    .select("queued_at, queuedByEmployee:employees!queued_by(full_name)")
    .eq("employee_id", employeeUuid)
    .eq("period_start", startDate)
    .eq("period_end", endDate)
    .order("queued_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  return data || null;
}
