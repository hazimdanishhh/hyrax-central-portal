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
// tableConfig.jsx/exportConfig.js) -- each becomes its own message when
// non-zero, so both the "Needs Reconciliation" filter and the DataTable
// row-flag badge (see PayrollExport.jsx) agree on exactly the same rule.
export function getRowReconciliationFlags(row) {
  const flags = [];
  const days = row.daysAbsentCount || 0;
  const conflicts = row.leaveAttendanceConflictCount || 0;
  const insufficientHalfDays = row.insufficientHalfDayHoursCount || 0;
  const leaveErrors = row.leaveFractionErrorCount || 0;

  if (days > 0) {
    flags.push(`${days} day${days === 1 ? "" : "s"} absent`);
  }
  if (conflicts > 0) {
    flags.push(
      `${conflicts} leave/attendance conflict${conflicts === 1 ? "" : "s"}`,
    );
  }
  if (insufficientHalfDays > 0) {
    flags.push(
      `${insufficientHalfDays} insufficient half-day hour record${insufficientHalfDays === 1 ? "" : "s"}`,
    );
  }
  if (leaveErrors > 0) {
    flags.push(`${leaveErrors} leave data error${leaveErrors === 1 ? "" : "s"}`);
  }

  return flags;
}

export function rowNeedsReconciliation(row) {
  return getRowReconciliationFlags(row).length > 0;
}
