// pages/user/hr/attendanceManagement/payrollExport/filterConfig.js

// department/employee/workLocation all forward straight to
// get_payroll_period_summary_rpc.sql's matching p_* parameters (see
// payrollPeriodSummaryService.js).
//
// "Needs Reconciliation" is different -- it's a client-side-only post-filter
// over rows the RPC already returned (see rowNeedsReconciliation below), not
// something forwarded to the RPC, so it's safe to offer here even though
// get_payroll_period_summary_rpc.sql has no matching parameter either.
export function getPayrollExportFilterConfig({ departments, employees, workLocations }) {
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
      key: "workLocation",
      label: "Work Location",
      options: (workLocations || []).map((w) => ({ label: w.name, value: w.id })),
    },
    {
      // One dropdown, one value at a time (SearchFilterBar only renders
      // react-select dropdowns) -- "true" is the original single-option
      // toggle (any of the 4 categories below), the rest are per-category
      // drill-downs so a click (from either this dropdown or an Overview
      // Cards tile -- see overviewConfig.js) narrows to exactly one kind of
      // problem instead of everything at once. getReconciliationCategoryPredicate
      // below is the single place that maps each value to its row predicate,
      // so this list and that predicate can never drift apart.
      key: "needsReconciliation",
      label: "Reconciliation",
      options: [
        { label: "Needs Reconciliation (Any)", value: "true" },
        { label: "Absent - Confirmed Unpaid", value: "confirmedAbsence" },
        { label: "Absent - Pending Review", value: "pendingAbsence" },
        { label: "Leave/Attendance Conflict", value: "leaveConflict" },
        { label: "Insufficient Half-Day Hours", value: "insufficientHalfDay" },
        { label: "Leave Data Error", value: "leaveFractionError" },
        { label: "Pending Approval Hours", value: "pendingApproval" },
      ],
    },
  ];
}

// One place for the four reconciliation counts this page surfaces (see
// tableConfig.jsx/exportConfig.js) -- each becomes its own message when
// non-zero, so both the "Needs Reconciliation" filter and the DataTable
// row-flag badge (see PayrollExport.jsx) agree on exactly the same rule.
export function getRowReconciliationFlags(row) {
  const flags = [];
  // OUTSTANDING counts, not the raw ones. daysAbsentCount /
  // insufficientHalfDayHoursCount stay whole for payroll -- an acknowledged
  // absence is still an absence and still an unpaid day -- so the reconciliation
  // badge reads the unacknowledged* counterparts instead. Reading the raw counts
  // here would leave a resolved day flagged forever, which is the exact problem
  // acknowledgement exists to fix.
  //
  // The other two categories have no unacknowledged* variant because they are
  // not acknowledgeable: both clear themselves once corrected leave arrives in
  // the next HR2000 sync.
  const days = row.unacknowledgedAbsenceCount ?? row.daysAbsentCount ?? 0;
  const conflicts = row.leaveAttendanceConflictCount || 0;
  const insufficientHalfDays =
    row.unacknowledgedInsufficientHalfDayCount ??
    row.insufficientHalfDayHoursCount ??
    0;
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

// Per-category predicates behind the "Reconciliation" filter's specific
// values (see getPayrollExportFilterConfig above) and every Overview Cards
// tile (overviewConfig.js) -- one place so a tile's count and what clicking
// it actually filters to can never silently disagree. "confirmedAbsence" is
// the one non-problem category (already reviewed) -- included here anyway so
// its card can drill down for audit purposes the same way every other card
// does, not because it needs reconciling.
export function getReconciliationCategoryPredicate(value) {
  switch (value) {
    case "confirmedAbsence":
      return (row) => (row.acknowledgedAbsenceCount || 0) > 0;
    case "pendingAbsence":
      return (row) => (row.unacknowledgedAbsenceCount || 0) > 0;
    case "leaveConflict":
      return (row) => (row.leaveAttendanceConflictCount || 0) > 0;
    case "insufficientHalfDay":
      return (row) => (row.unacknowledgedInsufficientHalfDayCount || 0) > 0;
    case "leaveFractionError":
      return (row) => (row.leaveFractionErrorCount || 0) > 0;
    case "pendingApproval":
      return (row) => Number(row.pendingApprovalHoursTotal || 0) > 0;
    case "true":
    default:
      return rowNeedsReconciliation;
  }
}
