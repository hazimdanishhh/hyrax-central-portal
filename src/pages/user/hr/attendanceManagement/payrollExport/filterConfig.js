// pages/user/hr/attendanceManagement/payrollExport/filterConfig.js

// Deliberately department/employee only (no Work Location) -- unlike
// overview/filterConfig.js, get_payroll_period_summary_rpc.sql has no
// p_work_location_id parameter, so offering that filter here would silently
// do nothing.
//
// "Needs Reconciliation" is different -- it's a client-side-only post-filter
// over rows the RPC already returned (see rowNeedsReconciliation below), not
// something forwarded to the RPC, so it's safe to offer here even though
// get_payroll_period_summary_rpc.sql has no matching parameter either.
export function getPayrollExportFilterConfig({ departments, employees }) {
  return [
    {
      key: "department",
      label: "Department",
      options: (departments || []).map((d) => ({ label: d.name, value: d.id })),
    },
    {
      key: "employee",
      label: "Employee",
      options: (employees || []).map((e) => ({ label: e.full_name, value: e.id })),
    },
    {
      // Single-option toggle -- same convention as employeeManagement/list/
      // filterConfig.js's contractEndingSoon (SearchFilterBar only renders
      // react-select dropdowns, there's no dedicated checkbox editor).
      key: "needsReconciliation",
      label: "Reconciliation",
      options: [{ label: "Needs Reconciliation", value: "true" }],
    },
  ];
}

// One place for the four reconciliation counts this page surfaces (see
// tableConfig.jsx/exportConfig.js) -- OR'd together, not AND'd: a row only
// needs to be flagged for one of the four to belong in "Needs
// Reconciliation".
export function rowNeedsReconciliation(row) {
  return (
    (row.daysAbsentCount || 0) > 0 ||
    (row.leaveAttendanceConflictCount || 0) > 0 ||
    (row.insufficientHalfDayHoursCount || 0) > 0 ||
    (row.leaveFractionErrorCount || 0) > 0
  );
}
