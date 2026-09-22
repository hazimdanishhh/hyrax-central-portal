// functions/payrollReconciliationLinks.js
//
// JS-side mirror of the SQL-side per-category query-param mapping (see
// queue_payroll_reconciliation_email_rpc.sql / send_payroll_reconciliation_
// notifications.sql) -- kept as a literal duplicate since JS and SQL can't
// share one file. Links into HR's OWN Attendance List (needs employee=,
// unlike the self-scoped My Attendance route the email/notifications link
// to), for PayrollReconciliationSidebar.jsx's own per-section deep links.
const CATEGORY_QUERY_PARAMS = {
  absent: "hrFlag=Absent&dayType=working",
  leave_conflict: "leaveAttendanceConflict=true",
  insufficient_half_day: "insufficientHalfDayHours=true",
  leave_fraction_error: "leaveFractionError=true",
  // Added 2026-09-15 for the Payroll Export sidebar's summary KPI cards
  // (kpiCardConfig.js) -- these aren't reconciliation categories (no
  // payroll_reconciliation_glossary entry, no email/notification category),
  // just extra deep-link targets for fields the sidebar shows above the
  // reconciliation sections. Safe to extend independently of the SQL-side
  // category mapping this file otherwise mirrors, since that mapping is
  // specifically about the 4 reconciliation flags, not every summary field.
  worked_on_holiday: "workedOnHoliday=true",
  worked_on_weekend: "workedOnWeekend=true",
  // Added 2026-09-22 for the sidebar's new "Pending Approval Hours" KPI card
  // -- hrFlag already has this exact value as a real, existing Attendance
  // List filter option (getAttendanceActivitiesFilterConfig), so this is a
  // genuinely precise deep link, not a "close enough" one like `absent` below.
  pending_approval: "hrFlag=Pending App Approval",
  // No extra flag -- just scope to this employee/period, for fields with no
  // single corresponding Attendance List filter (hours worked, leave days,
  // etc.). An intentionally valid, empty-string entry -- see the `params
  // === undefined` check below, not `!params`.
  generic: "",
};

export function buildHrAttendanceListLink({
  employeeUuid,
  code,
  startDate,
  endDate,
}) {
  const params = CATEGORY_QUERY_PARAMS[code];
  if (params === undefined || !employeeUuid) return null;

  const flagQuery = params ? `&${params}` : "";
  return `/app/hr/attendance/list?employee=${employeeUuid}${flagQuery}&startDate=${startDate}&endDate=${endDate}`;
}

/**
 * Deep link straight to ONE day's detail sidebar, rather than to a filtered
 * list the user then has to click through.
 *
 * `:attendanceId` is the synthetic row id normalizeUnifiedAttendance builds as
 * `${employee_uuid}_${work_date}`, and fetchAttendanceActivityById splits it
 * back apart and fetches that exact row -- so this resolves even when the day
 * isn't on the currently-loaded page. All three attendance list routes declare
 * the `:attendanceId` child, so it works on HR, My and Team Attendance alike.
 *
 * This is what makes the reconciliation loop one click: a flagged day links to
 * the day itself, where it can actually be fixed or acknowledged. The
 * list-level builder above stays for the per-section "View all N days" links,
 * which genuinely do want a filtered list.
 *
 * `workDate` MUST be the raw ISO date. In PayrollReconciliationSidebar the raw
 * (`sectionRow.workDate`) and the formatted copy sit a few lines apart under
 * near-identical names -- passing the formatted one produces a URL that looks
 * fine and resolves to nothing.
 */
export function buildAttendanceDayLink({
  employeeUuid,
  workDate,
  scope = "hr",
}) {
  if (!employeeUuid || !workDate) return null;

  const base =
    scope === "self"
      ? "/app/employee/attendance/list"
      : "/app/hr/attendance/list";

  return `${base}/${employeeUuid}_${workDate}`;
}
