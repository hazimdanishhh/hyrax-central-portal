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
// Segmented into labeled groups (Attendance/Overtime/Holiday/Weekend/Leave/
// Reconciliation). Most groups stay deliberately uncolored -- color is
// reserved for reconciliation STATUS (matches/mismatch/no-claim) once the
// Overtime/Weekend/Holiday Claims submodule
// (docs/OVERTIME-WEEKEND-HOLIDAY-CLAIMS-DESIGN.md) gives each "(Est.)" figure
// here a real approved "actual" to compare against -- spending color on mere
// category labeling now would either double up with that status meaning
// later or need ripping out and redoing.
//
// The new "Reconciliation" group (added 2026-09-22) is the one deliberate
// exception: those 3 cards ARE colored, using the exact same tokens/logic as
// Payroll Export's own Overview Cards row (overviewConfig.js) -- "Confirmed
// Unpaid Absences" is blue (a resolved fact, not a problem), "Pending Review
// - Absences"/"Pending Approval Hours" are red/green (financially
// consequential, block an accurate payroll run until resolved). Kept as its
// own small group rather than folded into "Attendance" so it visually reads
// as the same reconciliation-status channel the page-level cards already
// established, not a plain summary figure.
import { buildHrAttendanceListLink } from "@/functions/payrollReconciliationLinks";
import { formatHours } from "../../../../../functions/formatDate";

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
  // Same target as the "absent" reconciliation category's own email/
  // notification deep link -- scoped to this employee/period, not further
  // split by acknowledgement status, since the Attendance List has no
  // acknowledged-vs-pending hrFlag filter of its own (only the day sidebar,
  // opened from that list, actually shows which). Reused for both the
  // Confirmed and Pending Review absence cards below, same "close enough,
  // open the day to see the exact status" precedent holiday/weekend links
  // above already set.
  const absentLink = linkFor("absent");
  const pendingApprovalLink = linkFor("pending_approval");

  return [
    {
      groupLabel: "Reconciliation",
      cards: [
        {
          label: "Confirmed Unpaid Absences",
          value: row.acknowledgedAbsenceCount || 0,
          link: absentLink,
          variant: "blueCard",
          description:
            "Absences already reviewed and confirmed unpaid -- daysAbsentCount above already includes these, this is just the reviewed portion of it.",
        },
        {
          label: "Pending Review - Absences",
          value: row.unacknowledgedAbsenceCount || 0,
          link: absentLink,
          variant:
            (row.unacknowledgedAbsenceCount || 0) > 0 ? "redCard" : "greenCard",
          description:
            "Absences not yet reviewed -- resolve via Add Activity, applying leave, or acknowledging the absence before finalizing payroll.",
        },
        {
          label: "Pending App Approval Hours",
          value: Number(row.pendingApprovalHoursTotal || 0).toFixed(2),
          link: pendingApprovalLink,
          variant:
            Number(row.pendingApprovalHoursTotal || 0) > 0
              ? "redCard"
              : "greenCard",
          description:
            "Hours worked on app activities still awaiting manager/HR approval -- excluded from Hours Worked/Overtime Hours above until approved.",
        },
      ],
    },
    {
      groupLabel: "Attendance",
      cards: [
        {
          label: "Hours Worked",
          value: formatHours(row.hoursWorkedTotal || 0),
          link: genericLink,
        },
        {
          label: "Total Days Worked",
          value: `${row.totalWorkingDaysCount || 0} / ${row.actualDaysWorkedCount || 0}`,
          link: genericLink,
        },
        {
          label: "Overtime Hours",
          value: formatHours(row.overtimeHoursTotal || 0),
          link: genericLink,
          description: "Stale: Hours worked .",
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
          value: formatHours(row.holidayHoursWorkedTotal || 0),
          link: holidayLink,
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
          value: formatHours(row.weekendHoursWorkedTotal || 0),
          link: weekendLink,
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
    {
      groupLabel: "OT / WEEKEND / HOLIDAY WORK (ESTIMATED)",
      cards: [
        {
          label: "Normal Day OT Hours (Est.)",
          value: formatHours(row.estimatedNormalDayOtHoursTotal || 0),
          link: genericLink,
          description:
            "Hours worked beyond the normal work day, on a normal working day. Paid at 1.5x hourly rate (Employment Act s.60A).",
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
          value: formatHours(row.estimatedRestDayExcessHoursTotal || 0),
          link: weekendLink,
          description:
            "Rest-day hours worked beyond the normal daily hours. Paid an extra 2x hourly rate, on top of whichever day-wage tier above applies (Employment Act s.60(3)(c)).",
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
          value: formatHours(row.estimatedHolidayExcessHoursTotal || 0),
          link: holidayLink,
          description:
            "Hours worked on a public holiday beyond the normal daily hours. Paid an extra 3x hourly rate, on top of the 2-day tier above (Employment Act s.60D(3)(aa)).",
        },
      ],
    },
  ];
}
