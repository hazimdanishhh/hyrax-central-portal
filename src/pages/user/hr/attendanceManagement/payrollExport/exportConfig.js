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
  // See tableConfig.jsx's matching entry for why this is "(Est.)".
  { label: "Overtime Hours (Est.)", accessor: (row) => Number(row.overtimeHoursTotal || 0).toFixed(2) },
  // Approved-only -- see tableConfig.jsx's matching entry for the full explanation.
  { label: "Pending Approval Hours", accessor: (row) => Number(row.pendingApprovalHoursTotal || 0).toFixed(2) },
  { label: "Total Working Days", accessor: (row) => row.totalWorkingDaysCount || 0 },
  { label: "Actual Days Worked", accessor: (row) => row.actualDaysWorkedCount || 0 },
  { label: "Days Absent", accessor: (row) => row.daysAbsentCount || 0 },
  // Split of "Days Absent" by review status -- see tableConfig.jsx's matching entry.
  { label: "Confirmed Unpaid Absences", accessor: (row) => row.acknowledgedAbsenceCount || 0 },
  { label: "Pending Review (Absent)", accessor: (row) => row.unacknowledgedAbsenceCount || 0 },
  { label: "Holiday Days Worked", accessor: (row) => row.holidayDaysWorkedCount || 0 },
  { label: "Holiday Hours Worked", accessor: (row) => Number(row.holidayHoursWorkedTotal || 0).toFixed(2) },
  { label: "Weekend Days Worked", accessor: (row) => row.weekendDaysWorkedCount || 0 },
  { label: "Weekend Hours Worked", accessor: (row) => Number(row.weekendHoursWorkedTotal || 0).toFixed(2) },
  // Statutory rate-tier ESTIMATE columns (added 2026-09-15) -- see
  // tableConfig.jsx's matching entries for the "(Est.)" rationale.
  // "Normal Day OT Hours (Est.)" dropped 2026-09-22 -- see tableConfig.jsx's
  // matching note. It duplicated "Overtime Hours (Est.)" above.
  { label: "Rest Day 0.5x-Tier Days (Est.)", accessor: (row) => row.estimatedRestDayHalfTierDaysCount || 0 },
  { label: "Rest Day 1x-Tier Days (Est.)", accessor: (row) => row.estimatedRestDayFullTierDaysCount || 0 },
  { label: "Rest Day 2x Excess Hours (Est.)", accessor: (row) => Number(row.estimatedRestDayExcessHoursTotal || 0).toFixed(2) },
  { label: "Holiday 2x-Tier Days (Est.)", accessor: (row) => row.estimatedHolidayFullTierDaysCount || 0 },
  { label: "Holiday 3x Excess Hours (Est.)", accessor: (row) => Number(row.estimatedHolidayExcessHoursTotal || 0).toFixed(2) },
  { label: "Paid Leave Days", accessor: (row) => Number(row.paidLeaveDaysTotal || 0).toFixed(2) },
  { label: "Unpaid Leave Days", accessor: (row) => Number(row.unpaidLeaveDaysTotal || 0).toFixed(2) },
  { label: "Leave/Attendance Conflicts", accessor: (row) => row.leaveAttendanceConflictCount || 0 },
  { label: "Insufficient Half-Day Hours", accessor: (row) => row.insufficientHalfDayHoursCount || 0 },
  { label: "Leave Data Errors", accessor: (row) => row.leaveFractionErrorCount || 0 },
];
