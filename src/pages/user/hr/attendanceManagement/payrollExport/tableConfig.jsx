// pages/user/hr/attendanceManagement/payrollExport/tableConfig.jsx

// Read-only preview columns for the Payroll Period Summary DataTable --
// mirrors get_payroll_period_summary_rpc.sql's output shape 1:1. No
// `editable`/`editor` on any column: this page never edits rows, only
// previews what the CSV export (exportConfig.js) will contain.
export function payrollPeriodSummaryTableConfig() {
  return [
    { key: "companyEmployeeCode", label: "Employee Code", getValue: (row) => row.companyEmployeeCode },
    { key: "fullName", label: "Full Name", getValue: (row) => row.fullName },
    { key: "departmentName", label: "Department", getValue: (row) => row.departmentName || "--" },
    { key: "hoursWorkedTotal", label: "Hours Worked", getValue: (row) => Number(row.hoursWorkedTotal || 0).toFixed(2) },
    // "(Est.)" like every other statutory figure here: this is derived from
    // card scans and app sessions, not from HR's real OT claim form, and HR
    // reconciles the two before anything is paid. Employment Act s.60A --
    // hours beyond 8 paid hours in a day (see
    // hr_unified_daily_attendance_view.sql's overtime_hours).
    { key: "overtimeHoursTotal", label: "Overtime Hours (Est.)", getValue: (row) => Number(row.overtimeHoursTotal || 0).toFixed(2) },
    // Approved-only -- hoursWorkedTotal/overtimeHoursTotal above already
    // exclude Pending (unapproved) app-activity hours (see
    // hr_unified_daily_attendance_view.sql's approved_app_hours). This is the
    // withheld amount itself, so HR can see exactly how much is being held
    // back pending approval instead of it just silently not being in the total.
    { key: "pendingApprovalHoursTotal", label: "Pending Approval Hours", getValue: (row) => Number(row.pendingApprovalHoursTotal || 0).toFixed(2) },
    { key: "totalWorkingDaysCount", label: "Total Working Days", getValue: (row) => row.totalWorkingDaysCount || 0 },
    { key: "actualDaysWorkedCount", label: "Actual Days Worked", getValue: (row) => row.actualDaysWorkedCount || 0 },
    { key: "daysAbsentCount", label: "Days Absent", getValue: (row) => row.daysAbsentCount || 0 },
    // Kept despite now always equalling daysAbsentCount above, because it is
    // ACCURATE -- absence acknowledgement was removed on 2026-09-23, so every
    // absent day is genuinely unresolved until HR2000 clears it -- and it is
    // the column that carries red/green urgency (see kpiCardConfig.js), which
    // the plain count does not.
    //
    // Its former sibling "Confirmed Unpaid Absences" (acknowledgedAbsenceCount)
    // was removed in the same pass: the RPC still returns it, but it can only
    // ever be 0 now, and a permanently-zero column reads as "no confirmed
    // absences" rather than "this no longer exists".
    { key: "unacknowledgedAbsenceCount", label: "Pending Review (Absent)", getValue: (row) => row.unacknowledgedAbsenceCount || 0 },
    { key: "holidayDaysWorkedCount", label: "Holiday Days Worked", getValue: (row) => row.holidayDaysWorkedCount || 0 },
    { key: "holidayHoursWorkedTotal", label: "Holiday Hours Worked", getValue: (row) => Number(row.holidayHoursWorkedTotal || 0).toFixed(2) },
    { key: "weekendDaysWorkedCount", label: "Weekend Days Worked", getValue: (row) => row.weekendDaysWorkedCount || 0 },
    { key: "weekendHoursWorkedTotal", label: "Weekend Hours Worked", getValue: (row) => Number(row.weekendHoursWorkedTotal || 0).toFixed(2) },
    // Statutory rate-tier ESTIMATE columns (added 2026-09-15) -- "(Est.)" in
    // every label is deliberate, not decoration: these are reconciliation
    // estimates only, never the payable figure -- see
    // hr_unified_daily_attendance_view.sql's header comment on these
    // columns and docs/PAYROLL-DATA-REQUIREMENTS.md.
    //
    // "Normal Day OT Hours (Est.)" used to sit here. Dropped 2026-09-22: once
    // overtime_hours became the s.60A calculation itself, that column was an
    // exact duplicate of "Overtime Hours (Est.)" above, differing only in
    // that it still counted not-yet-approved hours -- which "Pending Approval
    // Hours" already reports on its own.
    { key: "estimatedRestDayHalfTierDaysCount", label: "Rest Day 0.5x-Tier Days (Est.)", getValue: (row) => row.estimatedRestDayHalfTierDaysCount || 0 },
    { key: "estimatedRestDayFullTierDaysCount", label: "Rest Day 1x-Tier Days (Est.)", getValue: (row) => row.estimatedRestDayFullTierDaysCount || 0 },
    { key: "estimatedRestDayExcessHoursTotal", label: "Rest Day 2x Excess Hours (Est.)", getValue: (row) => Number(row.estimatedRestDayExcessHoursTotal || 0).toFixed(2) },
    { key: "estimatedHolidayFullTierDaysCount", label: "Holiday 2x-Tier Days (Est.)", getValue: (row) => row.estimatedHolidayFullTierDaysCount || 0 },
    { key: "estimatedHolidayExcessHoursTotal", label: "Holiday 3x Excess Hours (Est.)", getValue: (row) => Number(row.estimatedHolidayExcessHoursTotal || 0).toFixed(2) },
    { key: "paidLeaveDaysTotal", label: "Paid Leave Days", getValue: (row) => Number(row.paidLeaveDaysTotal || 0).toFixed(2) },
    { key: "unpaidLeaveDaysTotal", label: "Unpaid Leave Days", getValue: (row) => Number(row.unpaidLeaveDaysTotal || 0).toFixed(2) },
    { key: "leaveAttendanceConflictCount", label: "Leave Conflicts", getValue: (row) => row.leaveAttendanceConflictCount || 0 },
    { key: "insufficientHalfDayHoursCount", label: "Insufficient Half-Day Hours", getValue: (row) => row.insufficientHalfDayHoursCount || 0 },
    { key: "leaveFractionErrorCount", label: "Leave Data Errors", getValue: (row) => row.leaveFractionErrorCount || 0 },
  ];
}
