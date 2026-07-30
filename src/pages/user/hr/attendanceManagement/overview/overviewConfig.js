import {
  ClockUserIcon,
  GaugeIcon,
  HourglassHighIcon,
  TrendDownIcon,
  TrendUpIcon,
  UserMinusIcon,
} from "@phosphor-icons/react";

// Mirrors getEmployeesOverviewConfig's tile shape and previous-period delta
// pattern exactly (calcDelta -> "up/down X% vs last period" sub-metric).
export function getAttendanceOverviewConfig(kpis = {}) {
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

  const avgHoursDelta = calcDelta(kpis.avgHoursWorked, kpis.prevAvgHoursWorked);
  const absentDaysDelta = calcDelta(
    kpis.absentDaysCount,
    kpis.prevAbsentDaysCount,
  );

  return [
    // ==========================================
    // TODAY'S SNAPSHOT (point-in-time, ignores the period filter)
    // ==========================================

    {
      icon: GaugeIcon,
      label: "Attendance Rate",
      sublabel: "Today, vs Active Headcount",
      value: `${kpis.attendanceRatePct || 0}%`,
      variant: "blueCardFill",
      to: null,
      metrics: [
        {
          label: "Present Today",
          value: kpis.presentTodayCount || 0,
        },
        {
          label: "Active Headcount",
          value: kpis.activeHeadcountToday || 0,
        },
      ],
      title:
        "Employees with any real check-in data today (hardware scan or app clock-in), divided by active headcount (Active/Probation/On Leave/Sabbatical). Point-in-time -- ignores the period filter below.",
    },
    {
      icon: ClockUserIcon,
      label: "Pending Approvals",
      sublabel: "Today",
      value: kpis.pendingApprovalsCount || 0,
      variant: kpis.pendingApprovalsCount > 0 ? "yellowCardFill" : "greenCard",
      to: "../list?hrFlag=Pending%20App%20Approval",
      metrics: [
        {
          label: "Missing Check-Outs",
          value: kpis.missingCheckoutsCount || 0,
        },
        {
          label: "Incomplete Card Scans",
          value: kpis.incompleteScansCount || 0,
        },
      ],
      title:
        "Self-service app clock-ins awaiting HR/manager approval today, plus two related anomaly counts -- an app session left open with no clock-out, and a hardware scan with only one badge tap recorded (no matching in/out pair). Click through to today's List, pre-filtered to Pending App Approval.",
    },

    // ==========================================
    // THIS PERIOD (period-bound)
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
