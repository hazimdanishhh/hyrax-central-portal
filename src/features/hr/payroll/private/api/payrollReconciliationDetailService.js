// features/hr/payroll/private/api/payrollReconciliationDetailService.js
import { supabase } from "../../../../../lib/supabaseClient";

/**
 * Backs PayrollReconciliationSidebar.jsx -- the day-level drilldown behind
 * one employee's reconciliation counts on the Payroll Export tab
 * (get_payroll_reconciliation_detail_rpc.sql, itself a thin wrapper around
 * the shared get_payroll_reconciliation_rows() helper also used by
 * queue_payroll_reconciliation_email_rpc.sql, so this list and the emailed
 * one can never disagree).
 */
export async function fetchPayrollReconciliationDetail({
  employeeUuid,
  startDate,
  endDate,
}) {
  const { data, error } = await supabase.rpc(
    "get_payroll_reconciliation_detail",
    {
      p_employee_uuid: employeeUuid,
      p_start_date: startDate,
      p_end_date: endDate,
    },
  );

  if (error) throw error;

  return data || [];
}
