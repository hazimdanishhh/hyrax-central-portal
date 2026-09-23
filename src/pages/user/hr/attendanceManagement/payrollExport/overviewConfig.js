// pages/user/hr/attendanceManagement/payrollExport/overviewConfig.js
import {
  HourglassIcon,
  WarningIcon,
  WarningOctagonIcon,
} from "@phosphor-icons/react";

// Client-side aggregate, mirroring computeCasesOverview's own precedent
// (employeeLifecycle/list) -- no separate RPC, just a sum over the rows
// usePayrollPeriodSummary already fetched. Always computed over the FULL
// `rows`, never `displayRows`, so the cards reflect the whole period
// regardless of which "Reconciliation" filter value happens to be active
// right now (a card showing "3" while its own filter is narrowed to
// something else that also happens to show 3 rows would be a coincidence,
// not a promise -- these numbers must stay the period's true totals).
export function computePayrollReconciliationOverview(rows) {
  return (rows || []).reduce(
    (acc, row) => {
      // No confirmedUnpaidAbsences accumulator, and there never can be one
      // again: absence acknowledgement was removed on 2026-09-23, so
      // acknowledgedAbsenceCount is permanently 0 and pendingAbsences now
      // equals the period's whole daysAbsentCount.
      acc.pendingAbsences += Number(row.unacknowledgedAbsenceCount || 0);
      acc.leaveConflicts += Number(row.leaveAttendanceConflictCount || 0);
      acc.insufficientHalfDay += Number(
        row.unacknowledgedInsufficientHalfDayCount || 0,
      );
      acc.leaveFractionErrors += Number(row.leaveFractionErrorCount || 0);
      acc.pendingApprovalHours += Number(row.pendingApprovalHoursTotal || 0);
      return acc;
    },
    {
      pendingAbsences: 0,
      leaveConflicts: 0,
      insufficientHalfDay: 0,
      leaveFractionErrors: 0,
      pendingApprovalHours: 0,
    },
  );
}

// One card per reconciliation category, instead of a single lumped "Needs
// Reconciliation" number -- the whole point of this file, per the request
// that led to it: HR should be able to see AND filter each kind of problem
// independently, not just an undifferentiated total.
//
// These are the five UNRESOLVED categories, matching
// getRowReconciliationFlags exactly -- so the tiles, the row badges and the
// "Needs Reconciliation (Any)" filter are all the same set. There is no
// confirmed-unpaid-absences tile; there was never one, and since 2026-09-23
// there is nothing left that could fill it.
//
// Segmenting/coloring, deliberately NOT a uniform red-when-nonzero across the
// board (that would just be the same lumped signal repeated five times):
// - "Insufficient Half-Day Hours" is yellowCard (not red) when nonzero -- per
//   its seeded acknowledgement reason ("Hours Reviewed and Accepted",
//   attendance_acknowledgement_reasons), this category is typically a benign
//   administrative gap, not a hard error, so it reads as lower-urgency than
//   the others rather than an equally red alarm.
// - Leave/Attendance Conflicts and Leave Data Errors are genuine
//   data-integrity problems with no benign reading -- redCard whenever
//   nonzero, greenCard at zero.
// - Unacknowledged Absences and Pending Approval Hours are both financially
//   consequential and time-bound -- they block an accurate payroll run until
//   resolved -- so redCard whenever nonzero, greenCard at zero. These two
//   tiles are why the page no longer carries a separate warning banner: they
//   say the same thing per category, in colour, and each one filters.
//
// `filter` on every tile spreads the page's OWN currently-active filters
// (`...filters`, e.g. the selected payroll period/department) before setting
// `needsReconciliation` -- required, not decorative: buildFilterUrl
// (OverviewCards' own link-building helper) builds its querystring purely
// from the object it's given, it does not merge with whatever is already in
// the URL. Without this spread, clicking any tile would silently drop the
// selected payroll cycle and any department/employee narrowing already
// applied. `to: ""` -- these tiles render ON Payroll Export itself, the same
// page they filter (no separate overview/list split here), mirroring
// employeeLifecycle/list/overviewConfig.js's own `to: ""` convention exactly.
export function getPayrollExportOverviewConfig(kpis, filters) {
  const filterFor = (value) => ({ ...filters, needsReconciliation: value });

  return [
    {
      label: "Unacknowledged Absences",
      value: kpis.pendingAbsences,
      icon: HourglassIcon,
      variant: kpis.pendingAbsences > 0 ? "redCard" : "greenCard",
      to: `/app/hr/attendance/payroll-export`,
      filter: filterFor("pendingAbsence"),
    },
    {
      label: "Leave/Attendance Conflicts",
      value: kpis.leaveConflicts,
      icon: WarningIcon,
      variant: kpis.leaveConflicts > 0 ? "redCard" : "greenCard",
      to: `/app/hr/attendance/payroll-export`,
      filter: filterFor("leaveConflict"),
    },
    {
      label: "Insufficient Half-Day Hours",
      value: kpis.insufficientHalfDay,
      icon: WarningIcon,
      variant: kpis.insufficientHalfDay > 0 ? "yellowCard" : "greenCard",
      to: `/app/hr/attendance/payroll-export`,
      filter: filterFor("insufficientHalfDay"),
    },
    {
      label: "Leave Data Errors",
      value: kpis.leaveFractionErrors,
      icon: WarningOctagonIcon,
      variant: kpis.leaveFractionErrors > 0 ? "redCard" : "greenCard",
      to: `/app/hr/attendance/payroll-export`,
      filter: filterFor("leaveFractionError"),
    },
    {
      label: "Pending Approval Hours",
      value: `${kpis.pendingApprovalHours.toFixed(2)} hrs`,
      icon: HourglassIcon,
      variant: kpis.pendingApprovalHours > 0 ? "redCard" : "greenCard",
      to: `/app/hr/attendance/payroll-export`,
      filter: filterFor("pendingApproval"),
    },
  ];
}
