import {
  AlarmIcon,
  ClockUserIcon,
  GaugeIcon,
  HourglassHighIcon,
  SignInIcon,
  SignOutIcon,
  TrendDownIcon,
  TrendUpIcon,
  UserMinusIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";

// Mirrors getEmployeesOverviewConfig's tile shape and previous-period delta
// pattern exactly (calcDelta -> "up/down X% vs last period" sub-metric), and
// its 8-tile count. Tiles are grouped by what they actually measure, not
// just "whatever fit" -- Today's Snapshot (point-in-time), Punctuality
// (period-bound, split cleanly into check-in-side vs check-out-side so each
// anomaly lives on the tile whose own metric it's derived from), Workload
// (period-bound), and Absenteeism Rate (period-bound).
//
// isPeriodFiltered ("Pass 4"): Attendance Rate/Pending Approvals/Attendance
// Anomalies fall back to today (or, for the two anomaly tiles' backlog
// counts, the true current backlog -- see get_attendance_dashboard_rpc.sql's
// header comment) when no period is selected, and switch to reflect the
// selected period once one is chosen. The RPC does the actual branching --
// this flag only picks which labels/sublabels/metric-row pairing to render,
// since kpis.* already carries whichever value applies.
export function getAttendanceOverviewConfig(kpis = {}, isPeriodFiltered = false) {
  const calcDelta = (current, previous) => {
    if (previous === null || previous === undefined) return null;
    if (previous === 0 && current === 0) return 0;
    if (previous === 0 && current > 0) return 100;

    return Math.round(((current - previous) / previous) * 100);
  };

  const deltaText = (delta) =>
    delta === null
      ? "No prior data"
      : delta > 0
        ? `↑ ${delta}% vs last period`
        : `↓ ${Math.abs(delta)}% vs last period`;

  const deltaIcon = (delta) =>
    delta === null ? null : delta >= 0 ? TrendUpIcon : TrendDownIcon;

  // "08:42" (24h, from the RPC) -> "8:42 AM". Purely a display transform --
  // the date component is a fixed placeholder, only the HH:MM matters.
  const formatTimeDisplay = (hhmm) => {
    if (!hhmm) return "--:--";
    return new Date(`1970-01-01T${hhmm}:00`).toLocaleTimeString("en-MY", {
      timeStyle: "short",
    });
  };

  // Hours as a decimal (e.g. 4.2) -- switches to days once it crosses 24h,
  // since "Oldest Pending Approval" can genuinely span multiple days.
  const formatHours = (hours) => {
    if (hours === null || hours === undefined) return "N/A";
    return hours >= 24 ? `${(hours / 24).toFixed(1)}d` : `${hours.toFixed(1)}h`;
  };

  const avgHoursDelta = calcDelta(kpis.avgHoursWorked, kpis.prevAvgHoursWorked);
  const absentDaysDelta = calcDelta(
    kpis.absentDaysCount,
    kpis.prevAbsentDaysCount,
  );
  const overtimeDelta = calcDelta(
    kpis.overtimeHoursTotal,
    kpis.prevOvertimeHoursTotal,
  );

  return [
    // ==========================================
    // TODAY'S SNAPSHOT (point-in-time, ignores the period filter)
    // ==========================================

    {
      icon: GaugeIcon,
      label: "Attendance Rate",
      sublabel: isPeriodFiltered
        ? "This Period, vs Working-Day Records"
        : "Today, vs Active Headcount",
      value: `${kpis.attendanceRatePct || 0}%`,
      variant: "blueCardFill",
      to: null,
      metrics: isPeriodFiltered
        ? [
            {
              label: "Present This Period",
              value: kpis.presentPeriodCount || 0,
            },
            {
              label: "Working-Day Records",
              value: kpis.workingDayRecordsCount || 0,
            },
          ]
        : [
            {
              label: "Present Today",
              value: kpis.presentTodayCount || 0,
            },
            {
              label: "Active Headcount",
              value: kpis.activeHeadcountToday || 0,
            },
          ],
      title: isPeriodFiltered
        ? "Employees with any real check-in data, divided by working-day records (Weekend/Rest-Day excluded), pooled across the selected period. Falls back to today's real-time snapshot whenever no period is selected."
        : "Employees with any real check-in data today (hardware scan or app clock-in), divided by active headcount (Active/Probation/On Leave/Sabbatical). Real-time by default -- switches to a period-wide rate once a period is selected below.",
    },
    {
      icon: ClockUserIcon,
      label: "Pending Approvals",
      sublabel: isPeriodFiltered ? "Originated This Period" : "Current Backlog",
      value: kpis.pendingApprovalsCount || 0,
      variant: kpis.pendingApprovalsCount > 0 ? "yellowCardFill" : "greenCard",
      to: "../list?hrFlag=Pending%20App%20Approval",
      metrics: [
        {
          label: "Avg Approval Turnaround",
          value: formatHours(kpis.avgApprovalTurnaroundHours),
        },
        {
          label: "Oldest Pending Approval",
          value: formatHours(kpis.oldestPendingApprovalHours),
        },
      ],
      title: isPeriodFiltered
        ? "Self-service app clock-ins awaiting HR/manager approval that were clocked in during the selected period and are still Pending, plus two turnaround signals: Avg Approval Turnaround (time between clock-in and the HR/manager decision, for activities Approved/Rejected this period) and Oldest Pending Approval (the longest-waiting Pending activity originated this period, how long it's been sitting, right now). Click through to today's List, pre-filtered to Pending App Approval."
        : "The true current backlog of self-service app clock-ins awaiting HR/manager approval, regardless of which day they were originally clocked in on (fixed from an earlier version of this tile that only counted items clocked in today) -- switches to only what originated in the selected period once one is chosen. Avg Approval Turnaround (time between clock-in and the HR/manager decision, for activities Approved/Rejected this period) and Oldest Pending Approval (how long the longest-waiting Pending activity has been sitting, right now). Click through to today's List, pre-filtered to Pending App Approval.",
    },
    {
      icon: WarningCircleIcon,
      label: "Attendance Anomalies",
      sublabel: isPeriodFiltered
        ? "This Period, Data-Quality Exceptions"
        : "Current Exceptions",
      // Sum-of-sub-metrics headline, same pattern Employee Overview's own
      // "HR Actions Needed" tile uses -- these are a different anomaly
      // class from Pending Approvals above (data-quality exceptions in the
      // raw punch data, not an approval-workflow state), so they get their
      // own tile rather than being folded into it.
      value: (kpis.missingCheckoutsCount || 0) + (kpis.incompleteScansCount || 0),
      variant:
        (kpis.missingCheckoutsCount || 0) + (kpis.incompleteScansCount || 0) > 0
          ? "redCard"
          : "greenCard",
      to: "../list?hrFlag=Missing%20App%20Check-Out",
      // Missing Check-Outs is a true backlog (an open session from days ago
      // is still worth flagging), Incomplete Card Scans is a per-day
      // hardware fact that never "resolves" -- so with no period selected,
      // the two sub-metrics genuinely mean different things (backlog vs
      // today). Tagged explicitly here rather than left ambiguous.
      metrics: [
        {
          label: isPeriodFiltered
            ? "Missing Check-Outs"
            : "Missing Check-Outs (Backlog)",
          value: kpis.missingCheckoutsCount || 0,
        },
        {
          label: isPeriodFiltered
            ? "Incomplete Card Scans"
            : "Incomplete Card Scans (Today)",
          value: kpis.incompleteScansCount || 0,
        },
      ],
      title: isPeriodFiltered
        ? "This period's raw punch-data exceptions: app clock-in sessions clocked in during the period that are still left open with no clock-out, and hardware badge scans with only one tap recorded that day (no matching in/out pair)."
        : "Current raw punch-data exceptions: Missing Check-Outs is the true backlog of app clock-in sessions still left open with no clock-out, regardless of which day they started (fixed from an earlier version that only counted sessions opened today). Incomplete Card Scans is today's count of hardware badge scans with only one tap recorded (no matching in/out pair) -- a per-day fact, not a lingering backlog.",
    },

    // ==========================================
    // PUNCTUALITY (period-bound) -- split by check-in vs check-out side, so
    // each anomaly (Late Arrivals, Early Leave) lives on the tile whose own
    // average time it's derived from.
    // ==========================================

    {
      icon: SignInIcon,
      label: "Average Check-In",
      sublabel: "This Period",
      value: formatTimeDisplay(kpis.avgCheckInTime),
      variant: "blueCard",
      to: null,
      metrics: [
        {
          label: "Late Arrivals",
          value: `${kpis.lateArrivalsCount || 0} (${kpis.lateArrivalRatePct || 0}%)`,
        },
      ],
      title:
        "Average first_in time-of-day across working-day records in the selected period (Weekend/Rest-Day and Absent records excluded). Late Arrivals is a fixed 09:00 company-wide assumption, not a real per-employee/department shift -- no shift/schedule table exists in this system yet; revisit this threshold once one does.",
    },
    {
      icon: SignOutIcon,
      label: "Average Check-Out",
      sublabel: "This Period",
      value: formatTimeDisplay(kpis.avgCheckOutTime),
      variant: "blueCard",
      to: null,
      metrics: [
        {
          label: "Early Leave",
          value: `${kpis.earlyLeaveCount || 0} (${kpis.earlyLeaveRatePct || 0}%)`,
        },
      ],
      title:
        "Average last_out time-of-day across working-day records in the selected period (Weekend/Rest-Day and Absent records excluded). Early Leave is a fixed 18:00 company-wide assumption, symmetric to Average Check-In's 09:00 -- same caveat: not a real per-employee/department shift, revisit once shift data exists.",
    },

    // ==========================================
    // WORKLOAD (period-bound)
    // ==========================================

    {
      icon: HourglassHighIcon,
      label: "Average Hours Worked",
      sublabel: "This Period",
      value: `${kpis.avgHoursWorked || 0}h`,
      variant: "greenCard",
      to: null,
      metrics: [
        {
          label: "Prev. Period",
          value: deltaText(avgHoursDelta),
          icon: deltaIcon(avgHoursDelta),
        },
      ],
      title:
        "Average hours_worked across working-day records in the selected period (Weekend/Rest-Day and Absent records excluded).",
    },
    {
      icon: AlarmIcon,
      label: "Overtime Hours",
      sublabel: "Total, This Period",
      value: `${kpis.overtimeHoursTotal || 0}h`,
      variant: kpis.overtimeHoursTotal > 0 ? "yellowCard" : "greenCard",
      to: null,
      metrics: [
        {
          label: "Prev. Period",
          value: deltaText(overtimeDelta),
          icon: deltaIcon(overtimeDelta),
        },
        {
          label: "Employees With Overtime",
          value: kpis.employeesWithOvertimeCount || 0,
        },
      ],
      title:
        "Sum of hours worked beyond 8h/day across working-day records in the selected period. Employees With Overtime shows whether it's concentrated in a few people or spread across the workforce.",
    },

    // ==========================================
    // ABSENTEEISM (period-bound)
    // ==========================================

    {
      icon: UserMinusIcon,
      label: "Absenteeism Rate",
      sublabel: "This Period",
      value: `${kpis.absenteeismRatePct || 0}%`,
      variant: kpis.absenteeismRatePct > 0 ? "redCard" : "greenCard",
      to: null,
      metrics: [
        {
          label: "Absent Days",
          value: kpis.absentDaysCount || 0,
        },
        {
          label: "Prev. Period",
          value: deltaText(absentDaysDelta),
          icon: deltaIcon(absentDaysDelta),
        },
      ],
      title:
        "Absent-flagged records divided by all working-day records (Weekend/Rest-Day excluded) in the selected period.",
    },
  ];
}
