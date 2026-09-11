// pages/user/hr/attendanceManagement/payrollExport/exportConfig.js
// {label, accessor} columns for CsvExportButton -- mirrors
// src/pages/user/sales/leads/list/constants/exportConfig.js's style (every
// accessor wrapped in a function, numbers formatted here rather than left
// to the CSV consumer). Same field set as tableConfig.jsx's on-screen
// preview, so the downloaded CSV always matches what HR just reviewed.
export const payrollPeriodSummaryExportColumns = [
  { label: "Employee Code", accessor: (row) => row.companyEmployeeCode },
  { label: "Full Name", accessor: (row) => row.fullName },
  { label: "Department", accessor: (row) => row.departmentName || "" },
  { label: "Hours Worked", accessor: (row) => Number(row.hoursWorkedTotal || 0).toFixed(2) },
  { label: "Overtime Hours", accessor: (row) => Number(row.overtimeHoursTotal || 0).toFixed(2) },
  { label: "Days Absent", accessor: (row) => row.daysAbsentCount || 0 },
  { label: "Holiday Days Worked", accessor: (row) => row.holidayDaysWorkedCount || 0 },
  { label: "Holiday Hours Worked", accessor: (row) => Number(row.holidayHoursWorkedTotal || 0).toFixed(2) },
  { label: "Weekend Days Worked", accessor: (row) => row.weekendDaysWorkedCount || 0 },
  { label: "Weekend Hours Worked", accessor: (row) => Number(row.weekendHoursWorkedTotal || 0).toFixed(2) },
  { label: "Paid Leave Days", accessor: (row) => Number(row.paidLeaveDaysTotal || 0).toFixed(2) },
  { label: "Unpaid Leave Days", accessor: (row) => Number(row.unpaidLeaveDaysTotal || 0).toFixed(2) },
  { label: "Leave/Attendance Conflicts", accessor: (row) => row.leaveAttendanceConflictCount || 0 },
  { label: "Insufficient Half-Day Hours", accessor: (row) => row.insufficientHalfDayHoursCount || 0 },
  { label: "Leave Data Errors", accessor: (row) => row.leaveFractionErrorCount || 0 },
];
