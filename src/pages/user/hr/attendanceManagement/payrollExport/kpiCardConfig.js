// pages/user/hr/attendanceManagement/payrollExport/kpiCardConfig.js
//
// Mini KPI cards for PayrollReconciliationSidebar.jsx -- every summary field
// on a Payroll Export row EXCEPT the 4 reconciliation counts (those get
// their own richer section below, with actual attendance cards -- see
// PayrollReconciliationSidebar.jsx's SECTIONS), so HR sees every number on
// the row before ever reaching the reconciliation section, each linking to
// the Attendance List filter that lets them manually verify it (opens in a
// new tab so the sidebar itself stays open).
//
// Segmented into labeled groups (Attendance/Overtime/Holiday/Weekend/Leave),
// deliberately NOT color-coded -- color is reserved for reconciliation
// STATUS (matches/mismatch/no-claim) once the Overtime/Weekend/Holiday
// Claims submodule (docs/OVERTIME-WEEKEND-HOLIDAY-CLAIMS-DESIGN.md) gives
// each "(Est.)" figure here a real approved "actual" to compare against.
// Spending color on mere category labeling now would either double up with
// that status meaning later or need ripping out and redoing -- plain
// grouping costs nothing and doesn't touch that channel.
import { buildHrAttendanceListLink } from "@/functions/payrollReconciliationLinks";

export function getPayrollSummaryKpiCards(row, { startDate, endDate }) {
  const linkFor = (code) =>
    buildHrAttendanceListLink({
      employeeUuid: row.employeeUuid,
      code,
      startDate,
      endDate,
    });

  const genericLink = linkFor("generic");
  const holidayLink = linkFor("worked_on_holiday");
  const weekendLink = linkFor("worked_on_weekend");

  return [
    {
      groupLabel: "Attendance",
      cards: [
        {
          label: "Hours Worked",
          value: Number(row.hoursWorkedTotal || 0).toFixed(2),
          link: genericLink,
        },
        {
          label: "Total Working Days",
          value: row.totalWorkingDaysCount || 0,
          link: genericLink,
        },
        {
          label: "Actual Days Worked",
          value: row.actualDaysWorkedCount || 0,
          link: genericLink,
        },
      ],
    },
    {
      groupLabel: "Overtime (Est.)",
      cards: [
        {
          label: "Overtime Hours",
          value: Number(row.overtimeHoursTotal || 0).toFixed(2),
          link: genericLink,
        },
        {
          label: "Normal Day OT Hours (Est.)",
          value: Number(row.estimatedNormalDayOtHoursTotal || 0).toFixed(2),
          link: genericLink,
          description:
            "Hours worked beyond the normal work day, on a normal working day. Paid at 1.5x hourly rate (Employment Act s.60A).",
        },
      ],
    },
    {
      groupLabel: "Holiday",
      cards: [
        {
          label: "Holiday Days Worked",
          value: row.holidayDaysWorkedCount || 0,
          link: holidayLink,
        },
        {
          label: "Holiday Hours Worked",
          value: Number(row.holidayHoursWorkedTotal || 0).toFixed(2),
          link: holidayLink,
        },
        {
          label: "Holiday 2x-Tier Days (Est.)",
          value: row.estimatedHolidayFullTierDaysCount || 0,
          link: holidayLink,
          description:
            "Public holidays worked up to the normal daily hours. Paid 2 days' wages, regardless of exactly how many hours within that day (Employment Act s.60D(3)(a)).",
        },
        {
          label: "Holiday 3x Excess Hours (Est.)",
          value: Number(row.estimatedHolidayExcessHoursTotal || 0).toFixed(2),
          link: holidayLink,
          description:
            "Hours worked on a public holiday beyond the normal daily hours. Paid an extra 3x hourly rate, on top of the 2-day tier above (Employment Act s.60D(3)(aa)).",
        },
      ],
    },
    {
      groupLabel: "Weekend",
      cards: [
        {
          label: "Weekend Days Worked",
          value: row.weekendDaysWorkedCount || 0,
          link: weekendLink,
        },
        {
          label: "Weekend Hours Worked",
          value: Number(row.weekendHoursWorkedTotal || 0).toFixed(2),
          link: weekendLink,
        },
        {
          label: "Rest Day 0.5x-Tier Days (Est.)",
          value: row.estimatedRestDayHalfTierDaysCount || 0,
          link: weekendLink,
          description:
            "Rest days (weekends) worked up to half the normal daily hours. Paid half a day's wages (Employment Act s.60(3)(a)).",
        },
        {
          label: "Rest Day 1x-Tier Days (Est.)",
          value: row.estimatedRestDayFullTierDaysCount || 0,
          link: weekendLink,
          description:
            "Rest days worked more than half, but not exceeding, the normal daily hours. Paid a full day's wages (Employment Act s.60(3)(b)).",
        },
        {
          label: "Rest Day 2x Excess Hours (Est.)",
          value: Number(row.estimatedRestDayExcessHoursTotal || 0).toFixed(2),
          link: weekendLink,
          description:
            "Rest-day hours worked beyond the normal daily hours. Paid an extra 2x hourly rate, on top of whichever day-wage tier above applies (Employment Act s.60(3)(c)).",
        },
      ],
    },
    {
      groupLabel: "Leave",
      cards: [
        {
          label: "Paid Leave Days",
          value: Number(row.paidLeaveDaysTotal || 0).toFixed(2),
          link: genericLink,
        },
        {
          label: "Unpaid Leave Days",
          value: Number(row.unpaidLeaveDaysTotal || 0).toFixed(2),
          link: genericLink,
        },
      ],
    },
  ];
}
