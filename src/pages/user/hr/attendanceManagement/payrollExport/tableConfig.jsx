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
    { key: "overtimeHoursTotal", label: "Overtime Hours", getValue: (row) => Number(row.overtimeHoursTotal || 0).toFixed(2) },
    { key: "daysAbsentCount", label: "Days Absent", getValue: (row) => row.daysAbsentCount || 0 },
    { key: "holidayDaysWorkedCount", label: "Holiday Days Worked", getValue: (row) => row.holidayDaysWorkedCount || 0 },
    { key: "holidayHoursWorkedTotal", label: "Holiday Hours Worked", getValue: (row) => Number(row.holidayHoursWorkedTotal || 0).toFixed(2) },
    { key: "weekendDaysWorkedCount", label: "Weekend Days Worked", getValue: (row) => row.weekendDaysWorkedCount || 0 },
    { key: "weekendHoursWorkedTotal", label: "Weekend Hours Worked", getValue: (row) => Number(row.weekendHoursWorkedTotal || 0).toFixed(2) },
    { key: "paidLeaveDaysTotal", label: "Paid Leave Days", getValue: (row) => Number(row.paidLeaveDaysTotal || 0).toFixed(2) },
    { key: "unpaidLeaveDaysTotal", label: "Unpaid Leave Days", getValue: (row) => Number(row.unpaidLeaveDaysTotal || 0).toFixed(2) },
    { key: "leaveAttendanceConflictCount", label: "Leave Conflicts", getValue: (row) => row.leaveAttendanceConflictCount || 0 },
    { key: "insufficientHalfDayHoursCount", label: "Insufficient Half-Day Hours", getValue: (row) => row.insufficientHalfDayHoursCount || 0 },
    { key: "leaveFractionErrorCount", label: "Leave Data Errors", getValue: (row) => row.leaveFractionErrorCount || 0 },
  ];
}
