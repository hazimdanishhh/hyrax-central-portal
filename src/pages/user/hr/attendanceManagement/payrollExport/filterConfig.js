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
      // toggle, the rest are per-category drill-downs so a click (from either
      // this dropdown or an Overview Cards tile -- see overviewConfig.js)
      // narrows to exactly one kind of problem instead of everything at once.
      // getReconciliationCategoryPredicate below is the single place that maps
      // each value to its row predicate, so this list and that predicate can
      // never drift apart.
      //
      // "Needs Reconciliation (Any)" is the union of the five categories
      // below it. Every option here is now an unresolved state -- see
      // getRowReconciliationFlags for the invariant that keeps that true.
      //
      // "Absent - Confirmed Unpaid" (confirmedAbsence) was removed on
      // 2026-09-23 along with absence acknowledgement itself. It was the one
      // RESOLVED state in this list, offered for audit drill-down; with
      // nothing able to produce an acknowledged absence any more it could only
      // ever filter to an empty table.
      key: "needsReconciliation",
      label: "Reconciliation",
      options: [
        { label: "Needs Reconciliation (Any)", value: "true" },
        { label: "Absent - Pending Review", value: "pendingAbsence" },
        { label: "Leave/Attendance Conflict", value: "leaveConflict" },
        { label: "Insufficient Half-Day Hours", value: "insufficientHalfDay" },
        { label: "Leave Data Error", value: "leaveFractionError" },
        { label: "Pending Approval Hours", value: "pendingApproval" },
      ],
    },
  ];
}

// One place for the five UNRESOLVED reconciliation categories this page
// surfaces (see tableConfig.jsx/exportConfig.js) -- each becomes its own
// message when non-zero, so the "Needs Reconciliation" filter, the DataTable
// row-flag badge (see PayrollExport.jsx), the Overview Cards tiles
// (overviewConfig.js) and the sidebar all agree on exactly the same rule.
//
// INVARIANT: this list is exactly the "Needs Reconciliation (Any)" filter,
// because rowNeedsReconciliation() below is literally "did this produce a
// flag?". So every value in getPayrollExportFilterConfig's dropdown that
// represents an UNRESOLVED problem must have a branch here. Since
// "confirmedAbsence" was removed on 2026-09-23, every value in that dropdown
// now does -- the list and the dropdown are one-to-one.
//
// Keep in step with getReconciliationCategoryPredicate at the bottom of this
// file: same categories, same source fields. They drifted once (pendingApproval
// had a predicate but no branch here, so a red "Pending Approval Hours" tile
// drilled into a table of rows with empty flag columns while "Any" excluded
// them outright) -- that is the failure this invariant exists to prevent.
export function getRowReconciliationFlags(row) {
  const flags = [];
  // OUTSTANDING counts, not the raw ones. insufficientHalfDayHoursCount stays
  // whole for payroll, so the reconciliation badge reads the unacknowledged*
  // counterpart instead; reading the raw count here would leave an
  // acknowledged day flagged forever, which is the exact problem
  // acknowledgement exists to fix.
  //
  // unacknowledgedAbsenceCount now always equals daysAbsentCount, since
  // absences stopped being acknowledgeable on 2026-09-23. It is read here
  // anyway rather than switched to the raw count: the RPC still computes both,
  // the fallback costs nothing, and this keeps the shape uniform with the
  // half-day line below.
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
  // Hours on app activities still sitting at Pending, i.e. withheld from the
  // payroll-eligible totals on this very page. Numeric rather than a count --
  // the RPC returns a sum of hours, not a number of days.
  const pendingApprovalHours = Number(row.pendingApprovalHoursTotal || 0);

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
  // .toFixed(2) to match how this same figure is rendered in tableConfig.jsx,
  // exportConfig.js and kpiCardConfig.js -- a badge reading "3.5 hours" beside
  // a column reading "3.50" invites the question of whether they are the
  // same number.
  if (pendingApprovalHours > 0) {
    flags.push(`${pendingApprovalHours.toFixed(2)} hours pending approval`);
  }

  return flags;
}

export function rowNeedsReconciliation(row) {
  return getRowReconciliationFlags(row).length > 0;
}

// Per-category predicates behind the "Reconciliation" filter's specific
// values (see getPayrollExportFilterConfig above) and every Overview Cards
// tile (overviewConfig.js) -- one place so a tile's count and what clicking
// it actually filters to can never silently disagree.
//
// Every branch here is now an unresolved problem. "confirmedAbsence"
// (acknowledgedAbsenceCount > 0) was the one exception -- a resolved state
// kept for audit drill-down -- and went with absence acknowledgement on
// 2026-09-23.
export function getReconciliationCategoryPredicate(value) {
  switch (value) {
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
