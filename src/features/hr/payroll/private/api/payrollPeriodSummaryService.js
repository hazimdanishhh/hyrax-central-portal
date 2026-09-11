// features/hr/payroll/private/api/payrollPeriodSummaryService.js
import { supabase } from "../../../../../lib/supabaseClient";

/**
 * Backs the Payroll Export tab (get_payroll_period_summary_rpc.sql) -- one
 * row per active employee for the selected cycle. Inherently
 * headcount-bounded, same precedent as fetchUnifiedAttendance's Day mode --
 * always returns the full result set for the period, so `search`/`sortBy`/
 * `sortOrder`/`isExport` are accepted only for drop-in compatibility with
 * CsvExportButton's `fetchFn` contract and are otherwise unused.
 *
 * filters uses the same startDate/endDate/department/employee keys every
 * other Attendance filter bar already writes (see
 * fetchAttendanceDashboard.js's buildAttendanceDashboardParams), so this
 * page can reuse SearchFilterBar/PayrollCycleFilterBar/filterConfig as-is
 * instead of inventing a new filter key convention.
 */
export async function fetchPayrollPeriodSummary({ filters } = {}) {
  const f = filters || {};

  const { data, error } = await supabase.rpc("get_payroll_period_summary", {
    p_start_date: f.startDate || null,
    p_end_date: f.endDate || null,
    p_department_id: f.department || null,
    p_employee_id: f.employee || null,
  });

  if (error) throw error;

  return { data: data || [] };
}
