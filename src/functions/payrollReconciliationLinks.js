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
};

export function buildHrAttendanceListLink({ employeeUuid, code, startDate, endDate }) {
  const params = CATEGORY_QUERY_PARAMS[code];
  if (!params || !employeeUuid) return null;

  return `/app/hr/attendance/list?employee=${employeeUuid}&${params}&startDate=${startDate}&endDate=${endDate}`;
}
