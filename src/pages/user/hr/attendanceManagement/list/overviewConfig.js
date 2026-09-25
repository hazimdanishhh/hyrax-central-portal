import {
  CalendarXIcon,
  ClockUserIcon,
  GaugeIcon,
  UserMinusIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";

// KPI strip for the 3 attendance list pages (HR Attendance Management, My
// Attendance, Team Attendance) -- redesigned 2026-09-25 to be a plain
// operational-queue strip, per DASHBOARD-CONVENTIONS.md §2a's own definition
// of what this kind of strip is for: "what in this list needs my attention
// right now", not a repeat of the Overview's descriptive stats. 5 flat,
// single-value tiles -- no nested `metrics` sub-rows, deliberately simpler
// than Attendance Overview's own grouped tiles, since every number here
// already IS one specific, individually-clickable filter, not a summary
// needing a breakdown. Two families (see get_attendance_dashboard_rpc.sql's
// header for the full 3-question rationale):
//
//   REGULAR -- defaults to THIS MONTH when no date range is set, matches the
//   selected range exactly once one is:
//     1. Attendance Rate -- present vs. working-day records.
//     4. Absent          -- day_state = 'absent'.
//
//   ACTIONABLE -- defaults to the TRUE CURRENT BACKLOG (unbounded by date)
//   when no range is set, "originated in the selected period" once one is
//   chosen -- these need HR's action regardless of which period is on
//   screen, not just what happened to originate this month:
//     2. Needs Reconciliation (All) -- unified_daily_attendance's own
//        needs_reconciliation flag: unacknowledged absence, leave conflict,
//        unacknowledged insufficient half-day, leave fraction error, or an
//        unapproved app-hours delta. The umbrella count.
//     3. Pending Approval -- self-service app clock-ins awaiting a decision.
//     5. Leave Conflict   -- a full day's leave on record, but real
//        attendance also exists that day.
//
// Both families always respect department/employee/manager/workLocation
// filters -- no exception there.
//
// Needs Reconciliation/Absent/Leave Conflict overlap in places (e.g. an
// unacknowledged absence counts toward both #2 and #4) by design -- they're
// independently useful filters this list's own filterConfig.js already
// exposes (needsReconciliation, dayState, leaveAttendanceConflict,
// approvalState), not mutually exclusive buckets of one total.
//
// Reuses get_attendance_dashboard's `kpis` shape unchanged (see
// useAttendanceListOverview.js/useMyAttendanceListOverview.js/
// useTeamAttendanceListOverview.js) -- the RPC itself does the backlog-vs-
// period switching; this file only formats/labels whatever it returns.
//
// CAVEAT: this RPC only accepts department/employee/manager/workLocation/
// date-range as filters -- the list's other, more granular filters (Day
// Type, Data Quality, Approval, Calendar, Presence, Overtime, Late Arrival,
// Early Leave, etc.) narrow the TABLE but are not reflected in these KPI
// numbers, since get_attendance_dashboard has no parameter for them. Numbers
// here match the table exactly for department/employee/manager/workLocation/
// date filtering; a narrower axis filter will show a smaller table than
// these tiles report.
//
// `baseFilter` -- the list's OWN current filters (plus, in Day mode, that
// day as startDate/endDate -- see each page's own wiring), so every
// drill-through (§2a: "every tile must resolve to a filter on that same
// list") narrows from where the user already is. `to: "."` re-filters this
// same page (see Invoices' overviewConfig.js for the precedent).
export function getAttendanceListOverviewConfig(kpis = {}, baseFilter = {}) {
  const tileVariant = (count) => (count > 0 ? "redCard" : "greenCard");

  const isPeriodFiltered = Boolean(baseFilter.startDate && baseFilter.endDate);
  const periodLabel = isPeriodFiltered ? "This Period" : "This Month";
  const actionableLabel = isPeriodFiltered ? "This Period" : "Current Backlog";

  // Actionable tiles drop any date range from their own drill-through when
  // unfiltered (true backlog, matching the RPC's own unbounded query) --
  // otherwise the exact selection, same as baseFilter already carries.
  const { startDate: _startDate, endDate: _endDate, ...noDateFilter } =
    baseFilter;
  const actionableFilter = isPeriodFiltered ? baseFilter : noDateFilter;

  // REGULAR tiles (Attendance Rate, Absent) -- 2026-09-25 fix: the number
  // itself defaults to This Month when unfiltered (period_rows), but
  // baseFilter carries no date at all in that case (Search mode with no
  // range picked), so clicking through previously showed the list's true
  // all-time rows -- a bigger, mismatched set than the tile's own number.
  // Explicitly inject the same This-Month default here, matching the
  // Overview page's own periodFilter.
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${new Date().getFullYear()}-${String(
    new Date().getMonth() + 1,
  ).padStart(2, "0")}-01`;
  const regularFilter = {
    ...baseFilter,
    startDate: baseFilter.startDate || monthStart,
    endDate: baseFilter.endDate || today,
  };

  return [
    {
      icon: GaugeIcon,
      label: "Attendance Rate",
      sublabel: periodLabel,
      value: `${kpis.attendanceRatePct || 0}%`,
      variant: "blueCard",
      to: ".",
      filter: { ...regularFilter, presentOnly: "true" },
      title: "How many employees checked in, out of everyone expected to.",
    },
    {
      icon: WarningCircleIcon,
      label: "Needs Reconciliation (All)",
      sublabel: actionableLabel,
      value: kpis.needsReconciliationCount || 0,
      variant: tileVariant(kpis.needsReconciliationCount),
      to: ".",
      filter: { ...actionableFilter, needsReconciliation: "true" },
      title: "Records that need HR's attention right now.",
    },
    {
      icon: ClockUserIcon,
      label: "Pending Approval",
      sublabel: actionableLabel,
      value: kpis.pendingApprovalsCount || 0,
      variant: tileVariant(kpis.pendingApprovalsCount),
      to: ".",
      filter: { ...actionableFilter, approvalState: "pending" },
      title: "Clock-ins still waiting for approval.",
    },
    {
      icon: UserMinusIcon,
      label: "Absent",
      sublabel: periodLabel,
      value: kpis.absentDaysCount || 0,
      variant: tileVariant(kpis.absentDaysCount),
      to: ".",
      filter: { ...regularFilter, dayState: "absent" },
      title: "Days marked absent.",
    },
    {
      icon: CalendarXIcon,
      label: "Leave Conflict",
      sublabel: actionableLabel,
      value: kpis.leaveConflictCount || 0,
      variant: tileVariant(kpis.leaveConflictCount),
      to: ".",
      filter: { ...actionableFilter, leaveAttendanceConflict: "true" },
      title:
        "Leave was approved, but the employee also has attendance recorded that day.",
    },
  ];
}
