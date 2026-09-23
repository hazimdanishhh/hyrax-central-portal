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
  // No linkFor("absent") / linkFor("pending_approval") here: both cards below
  // that would have used them build their own URL instead, because each needs
  // to narrow further than the shared category link does -- the absence card
  // adds needsReconciliation=true (linkFor("absent") deliberately doesn't split
  // by acknowledgement status), and the pending-approval card targets the
  // hrFlag value directly.
  const overtimeLink = linkFor("overtime_only");
  const onLeaveLink = linkFor("on_leave_only");

  return [
    {
      groupLabel: "Reconciliation",
      cards: [
        // A "Confirmed Unpaid Absences" card (acknowledgedAbsenceCount, blue)
        // sat here and was deliberately dropped: this group answers "what
        // still needs HR's attention", and a reviewed absence doesn't. The
        // reviewed portion is still reachable from Payroll Export's own
        // "Absent - Confirmed Unpaid" reconciliation filter.
        {
          label: "Unacknowledged Absences",
          value: row.unacknowledgedAbsenceCount || 0,
          link: `/app/hr/attendance/list?employee=${row.employeeUuid}&startDate=${startDate}&endDate=${endDate}&dayState=absent&needsReconciliation=true`,
          variant:
            (row.unacknowledgedAbsenceCount || 0) > 0 ? "redCard" : "greenCard",
          description:
            "Absences not yet reviewed -- resolve via Add Activity, applying leave, or acknowledging the absence before finalizing payroll.",
        },
        {
          label: "Leave/Attendance Conflicts",
          value: row.leaveAttendanceConflictCount || 0,
          variant:
            row.leaveAttendanceConflictCount > 0 ? "redCard" : "greenCard",
          link: `/app/hr/attendance/list?employee=${row.employeeUuid}&startDate=${startDate}&endDate=${endDate}&leaveAttendanceConflict=true&needsReconciliation=true`,
        },
        {
          label: "Insufficient Half-Day Hours",
          value: row.unacknowledgedInsufficientHalfDayCount || 0,
          variant:
            row.unacknowledgedInsufficientHalfDayCount > 0
              ? "yellowCard"
              : "greenCard",
          link: `/app/hr/attendance/list?employee=${row.employeeUuid}&startDate=${startDate}&endDate=${endDate}&insufficientHalfDayHours=true&needsReconciliation=true`,
        },
        {
          label: "Pending App Approval Hours",
          value: Number(row.pendingApprovalHoursTotal || 0).toFixed(2),
          link: `/app/hr/attendance/list?employee=${row.employeeUuid}&startDate=${startDate}&endDate=${endDate}&approvalState=pending`,
          variant:
            Number(row.pendingApprovalHoursTotal || 0) > 0
              ? "redCard"
              : "greenCard",
          description:
            "Hours worked on app activities still awaiting manager/HR approval -- excluded from Hours Worked above, and from Overtime Hours (Est.) below, until approved.",
        },
      ],
    },
    {
      groupLabel: "Attendance",
      cards: [
        {
          label: "Hours Worked",
          value: `${formatHours(row.hoursWorkedTotal || 0)} / ${formatHours(row.totalWorkingDaysCount * 8)}`,
          link: genericLink,
        },
        {
          label: "Total Days Worked",
          value: `${row.actualDaysWorkedCount || 0} / ${row.totalWorkingDaysCount || 0}`,
          link: genericLink,
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
          link: onLeaveLink,
        },
        {
          label: "Unpaid Leave Days",
          value: Number(row.unpaidLeaveDaysTotal || 0).toFixed(2),
          link: onLeaveLink,
        },
      ],
    },
    {
      groupLabel: "OT / WEEKEND / HOLIDAY WORK (ESTIMATED)",
      cards: [
        // Moved here from the "Attendance" group 2026-09-22, and renamed from
        // a bare "Overtime Hours". It belongs with the other estimates: it is
        // derived from card scans and app sessions, not from HR's real OT
        // claim form, and HR reconciles the two before anything is paid.
        // Replaces the old "Normal Day OT Hours (Est.)" card, which read
        // estimatedNormalDayOtHoursTotal -- now an exact duplicate of this
        // one, since overtime_hours IS the s.60A calculation.
        {
          label: "Work Day Overtime Hours (Est.)",
          value: formatHours(row.overtimeHoursTotal || 0),
          link: overtimeLink,
          variant:
            (row.overtimeHoursTotal || 0) > 0 ? "yellowCard" : "greenCard",
          description:
            "Hours worked beyond the normal 8 paid hours in a day, on a normal working day. Based purely on time on site, not on what time the employee left -- a 10-hour day is 1 hour of overtime whether it ran 07:30-17:30 or 09:00-19:00. (8 paid hours means a 9-hour span, since the 1-hour unpaid lunch sits inside it.) Paid at 1.5x hourly rate (Employment Act s.60A). Approved activities only; anything still awaiting approval is reported separately under Pending Approval Hours.",
        },
        {
          label: "Rest Day 0.5x Days (Est.)",
          value: row.estimatedRestDayHalfTierDaysCount || 0,
          link: weekendLink,
          variant:
            (row.estimatedRestDayHalfTierDaysCount || 0) > 0
              ? "yellowCard"
              : "greenCard",
          description:
            "Rest days (weekends) worked up to half the normal daily hours. Paid half a day's wages (Employment Act s.60(3)(a)).",
        },
        {
          label: "Rest Day 1x Days (Est.)",
          value: row.estimatedRestDayFullTierDaysCount || 0,
          link: weekendLink,
          variant:
            (row.estimatedRestDayFullTierDaysCount || 0) > 0
              ? "yellowCard"
              : "greenCard",
          description:
            "Rest days worked more than half, but not exceeding, the normal daily hours. Paid a full day's wages (Employment Act s.60(3)(b)).",
        },
        {
          label: "Rest Day 2x Excess Hours (Est.)",
          value: formatHours(row.estimatedRestDayExcessHoursTotal || 0),
          link: weekendLink,
          variant:
            (row.estimatedRestDayExcessHoursTotal || 0) > 0
              ? "yellowCard"
              : "greenCard",
          description:
            "Rest-day hours worked beyond the normal daily hours. Paid an extra 2x hourly rate, on top of whichever day-wage tier above applies (Employment Act s.60(3)(c)).",
        },
        {
          label: "Holiday 2x Days (Est.)",
          value: row.estimatedHolidayFullTierDaysCount || 0,
          link: holidayLink,
          variant:
            (row.estimatedHolidayFullTierDaysCount || 0) > 0
              ? "yellowCard"
              : "greenCard",
          description:
            "Public holidays worked up to the normal daily hours. Paid 2 days' wages, regardless of exactly how many hours within that day (Employment Act s.60D(3)(a)).",
        },
        {
          label: "Holiday 3x Excess Hours (Est.)",
          value: formatHours(row.estimatedHolidayExcessHoursTotal || 0),
          link: holidayLink,
          variant:
            (row.estimatedHolidayExcessHoursTotal || 0) > 0
              ? "yellowCard"
              : "greenCard",
          description:
            "Hours worked on a public holiday beyond the normal daily hours. Paid an extra 3x hourly rate, on top of the 2-day tier above (Employment Act s.60D(3)(aa)).",
        },
      ],
    },
  ];
}
