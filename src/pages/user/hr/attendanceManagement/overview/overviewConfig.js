import {
  AlarmIcon,
  CalendarXIcon,
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
import { getStatusVariant } from "../../../../../functions/statusVariant";

// Mirrors getEmployeesOverviewConfig's tile shape and previous-period delta
// pattern exactly (calcDelta -> "up/down X% vs last period" sub-metric), and
// its 8-tile count. Tiles are grouped by what they actually measure, not
// just "whatever fit" -- Today's Snapshot (point-in-time), Punctuality
// (period-bound, split cleanly into check-in-side vs check-out-side so each
// anomaly lives on the tile whose own metric it's derived from), Workload
// (period-bound), and Absenteeism Rate (period-bound).
//
// isPeriodFiltered: Attendance Rate/Pending Approvals/Attendance Anomalies
// fall back to today (or, for the two anomaly tiles' backlog counts, the
// true current backlog -- see get_attendance_dashboard_rpc.sql's header
// comment) when no period is selected, and switch to reflect the selected
// period once one is chosen. The RPC does the actual branching -- this flag
// only picks which labels/sublabels/metric-row pairing to render, since
// kpis.* already carries whichever value applies.
//
// Drill-through pass: `filters` is the Overview's OWN active department/
// employee/period filters -- threaded into every link below so a tile click
// doesn't silently drop whatever the user had already narrowed down to.
// Unlike Employee Overview (all-time default), Attendance's period-bound
// KPIs default to MONTH-TO-DATE server-side when no period is selected
// (get_attendance_dashboard_rpc.sql), so periodFilter below reproduces that
// MTD default explicitly rather than leaving dates unbounded, which would
// show a different, larger all-time set than the KPI actually represents.
// Two tiles are the exception and use a true unbounded backlog instead of
// MTD when unfiltered -- Pending Approvals and Missing Check-Outs -- handled
// individually below, mirroring the RPC's own v_has_period branching.
export function getAttendanceOverviewConfig(
  kpis = {},
  isPeriodFiltered = false,
  filters = {},
) {
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
  const leaveDaysDelta = calcDelta(kpis.leaveDaysCount, kpis.prevLeaveDaysCount);

  // Carried into every link below -- the Overview's own department/employee
  // narrowing, so a tile click never silently resets it.
  const baseFilter = {
    ...(filters.department && { department: filters.department }),
    ...(filters.employee && { employee: filters.employee }),
  };

  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${new Date().getFullYear()}-${String(
    new Date().getMonth() + 1,
  ).padStart(2, "0")}-01`;

  // Every period-bound tile's default when unfiltered is MTD, not all-time
  // (see header comment) -- this always has a value, unlike Employee
  // Overview's equivalent helper.
  const periodFilter = {
    startDate: filters.startDate || monthStart,
    endDate: filters.endDate || today,
  };

  // "Today" tiles (Attendance Rate's Present/Working-Day sub-metrics,
  // Incomplete Card Scans when unfiltered) use today specifically, not MTD,
  // matching presentTodayCount/activeHeadcountToday/incompleteScansCount's
  // own true-today scope in the RPC.
  const todaySnapshotDates = isPeriodFiltered
    ? { startDate: filters.startDate, endDate: filters.endDate }
    : { startDate: today, endDate: today };

  // Dynamic tile severity (see docs/DASHBOARD-CONVENTIONS.md's "KPI Card
  // Color & Fill Convention"). Thresholds below are documented estimates,
  // not audited HR policy -- tune freely without touching statusVariant.js.
  const pendingApprovalsCount = kpis.pendingApprovalsCount || 0;
  // A backlog to clear, not a crisis -- worst tier is "warning", not
  // "critical", so it fills yellow, never red.
  const pendingApprovalsStatus = getStatusVariant(pendingApprovalsCount, {
    direction: "low-good",
    tiers: 2,
    badLevel: "warning",
    thresholds: { criticalAt: 1 },
  });
  const attendanceAnomaliesCount =
    (kpis.missingCheckoutsCount || 0) + (kpis.incompleteScansCount || 0);
  const attendanceAnomaliesStatus = getStatusVariant(attendanceAnomaliesCount, {
    direction: "low-good",
    tiers: 2,
    badLevel: "critical",
    thresholds: { criticalAt: 1 },
  });
  const avgHoursWorkedStatus = getStatusVariant(kpis.avgHoursWorked, {
    direction: "target-band",
    thresholds: { target: 8, warningTolerance: 0.5, criticalTolerance: 1 },
  });
  // 0.01 approximates "any nonzero total" for a continuous hours value,
  // same as the count-based tiles above do for integers with criticalAt: 1.
  const overtimeStatus = getStatusVariant(kpis.overtimeHoursTotal || 0, {
    direction: "low-good",
    tiers: 2,
    badLevel: "warning",
    thresholds: { criticalAt: 0.01 },
  });
  const absenteeismStatus = getStatusVariant(kpis.absenteeismRatePct || 0, {
    direction: "low-good",
    thresholds: { warningAt: 3, criticalAt: 6 },
  });

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
      // A rate has no matching row-set -- was already correctly unlinked.
      to: null,
      metrics: isPeriodFiltered
        ? [
            {
              label: "Present This Period",
              value: kpis.presentPeriodCount || 0,
              to: "../list",
              filter: {
                ...baseFilter,
                presentOnly: "true",
                ...todaySnapshotDates,
              },
            },
            {
              label: "Working-Day Records",
              value: kpis.workingDayRecordsCount || 0,
              to: "../list",
              filter: {
                ...baseFilter,
                workingDayOnly: "true",
                ...todaySnapshotDates,
              },
            },
          ]
        : [
            {
              label: "Present Today",
              value: kpis.presentTodayCount || 0,
              to: "../list",
              filter: {
                ...baseFilter,
                presentOnly: "true",
                ...todaySnapshotDates,
              },
            },
            {
              label: "Active Headcount",
              value: kpis.activeHeadcountToday || 0,
              // Sourced from employees/employment_status directly, not
              // attendance data (unified_daily_attendance only has rows for
              // days something already happened) -- the only accurate
              // target is the Employee List's own active-bucket filter, a
              // cross-page link.
              to: "/app/hr/employees/list",
              filter: { statusBucket: "active" },
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
      value: pendingApprovalsCount,
      variant: pendingApprovalsStatus.variant,
      status: {
        icon: pendingApprovalsStatus.statusIcon,
        label: pendingApprovalsStatus.statusLabel,
      },
      to: "../list",
      // Backlog (no date bound) when unfiltered, mirroring
      // pending_backlog_count exactly -- only date-bound once a period is
      // actually selected, mirroring pending_period_count.
      filter: {
        ...baseFilter,
        hrFlag: "Pending App Approval",
        ...(isPeriodFiltered && {
          startDate: filters.startDate,
          endDate: filters.endDate,
        }),
      },
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
        ? "Self-service app clock-ins awaiting HR/manager approval that were clocked in during the selected period and are still Pending, plus two turnaround signals: Avg Approval Turnaround (time between clock-in and the HR/manager decision, for activities Approved/Rejected this period) and Oldest Pending Approval (the longest-waiting Pending activity originated this period, how long it's been sitting, right now). Click through to the List, pre-filtered to Pending App Approval."
        : "The true current backlog of self-service app clock-ins awaiting HR/manager approval, regardless of which day they were originally clocked in on (fixed from an earlier version of this tile that only counted items clocked in today) -- switches to only what originated in the selected period once one is chosen. Avg Approval Turnaround (time between clock-in and the HR/manager decision, for activities Approved/Rejected this period) and Oldest Pending Approval (how long the longest-waiting Pending activity has been sitting, right now). Click through to the List, pre-filtered to Pending App Approval.",
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
      value: attendanceAnomaliesCount,
      variant: attendanceAnomaliesStatus.variant,
      status: {
        icon: attendanceAnomaliesStatus.statusIcon,
        label: attendanceAnomaliesStatus.statusLabel,
      },
      // The headline sums two independent hr_flag buckets -- no single
      // filter reproduces it (the previous hardcoded link only ever showed
      // half of what was summed). Each reason is its own sub-metric
      // instead, same treatment as Employee Overview's Data Gaps tile.
      to: null,
      metrics: [
        {
          label: isPeriodFiltered
            ? "Missing Check-Outs"
            : "Missing Check-Outs (Backlog)",
          value: kpis.missingCheckoutsCount || 0,
          to: "../list",
          filter: {
            ...baseFilter,
            hrFlag: "Missing App Check-Out",
            ...(isPeriodFiltered && {
              startDate: filters.startDate,
              endDate: filters.endDate,
            }),
          },
        },
        {
          label: isPeriodFiltered
            ? "Incomplete Card Scans"
            : "Incomplete Card Scans (Today)",
          value: kpis.incompleteScansCount || 0,
          to: "../list",
          filter: {
            ...baseFilter,
            hrFlag: "Incomplete Card Scans",
            ...todaySnapshotDates,
          },
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
      // An average has no exact matching row-set -- links to the working-day
      // population it's averaged over, the best available "see who" target.
      to: "../list",
      filter: { ...baseFilter, workingDayOnly: "true", ...periodFilter },
      metrics: [
        {
          label: "Late Arrivals",
          value: `${kpis.lateArrivalsCount || 0} (${kpis.lateArrivalRatePct || 0}%)`,
          to: "../list",
          filter: { ...baseFilter, lateArrival: "true", ...periodFilter },
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
      to: "../list",
      filter: { ...baseFilter, workingDayOnly: "true", ...periodFilter },
      metrics: [
        {
          label: "Early Leave",
          value: `${kpis.earlyLeaveCount || 0} (${kpis.earlyLeaveRatePct || 0}%)`,
          to: "../list",
          filter: { ...baseFilter, earlyLeave: "true", ...periodFilter },
        },
      ],
      title:
        "Average last_out time-of-day across working-day records in the selected period (Weekend/Rest-Day and Absent records excluded). Early Leave means leaving before 5:00 PM (17:00), a fixed company-wide assumption for now -- will become per-work-location once employees carry a work location assignment (see docs/WORK-LOCATIONS-ARCHITECTURE.md).",
    },

    // ==========================================
    // WORKLOAD (period-bound)
    // ==========================================

    {
      icon: HourglassHighIcon,
      label: "Average Hours Worked",
      sublabel: "This Period",
      value: `${kpis.avgHoursWorked || 0}h`,
      variant: avgHoursWorkedStatus.variant,
      status: {
        icon: avgHoursWorkedStatus.statusIcon,
        label: avgHoursWorkedStatus.statusLabel,
      },
      to: "../list",
      filter: { ...baseFilter, workingDayOnly: "true", ...periodFilter },
      metrics: [
        {
          label: "Prev. Period",
          value: deltaText(avgHoursDelta),
          icon: deltaIcon(avgHoursDelta),
          // A delta has no matching row-set -- not linked.
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
      variant: overtimeStatus.variant,
      status: { icon: overtimeStatus.statusIcon, label: overtimeStatus.statusLabel },
      to: "../list",
      filter: { ...baseFilter, overtimeOnly: "true", ...periodFilter },
      metrics: [
        {
          label: "Prev. Period",
          value: deltaText(overtimeDelta),
          icon: deltaIcon(overtimeDelta),
        },
        {
          label: "Employees With Overtime",
          value: kpis.employeesWithOvertimeCount || 0,
          to: "../list",
          filter: { ...baseFilter, overtimeOnly: "true", ...periodFilter },
        },
      ],
      title:
        "Sum of hours worked after 6:00 PM (18:00) across working-day records in the selected period -- not hours above 8/day, and not affected by what time the employee arrived. Employees With Overtime is a distinct-employee count, while its link shows one row per qualifying day -- an employee with overtime on 3 different days appears 3 times in the list but counts once here.",
    },

    // ==========================================
    // ABSENTEEISM (period-bound)
    // ==========================================

    {
      icon: UserMinusIcon,
      label: "Absenteeism Rate",
      sublabel: "This Period",
      value: `${kpis.absenteeismRatePct || 0}%`,
      variant: absenteeismStatus.variant,
      status: { icon: absenteeismStatus.statusIcon, label: absenteeismStatus.statusLabel },
      // The rate's own denominator population (all working-day records),
      // not just the absent slice -- Absent Days below is the sub-metric
      // for that.
      to: "../list",
      filter: { ...baseFilter, workingDayOnly: "true", ...periodFilter },
      metrics: [
        {
          label: "Absent Days",
          value: kpis.absentDaysCount || 0,
          to: "../list",
          filter: { ...baseFilter, hrFlag: "Absent", ...periodFilter },
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

    // ==========================================
    // LEAVE (period-bound) -- HR2000 leave ledger integration. Grouped next
    // to Absenteeism Rate since both measure workforce availability; unlike
    // absenteeism this is never a "problem" figure, so it never gets a
    // status-variant color -- a plain neutral tile, matching how Pending
    // Approvals' own turnaround sub-metrics are unstatused too.
    // ==========================================
    {
      icon: CalendarXIcon,
      label: "Leave Days",
      sublabel: "Total, This Period",
      value: kpis.leaveDaysCount || 0,
      variant: "blueCard",
      to: "../list",
      filter: { ...baseFilter, onLeave: "true", ...periodFilter },
      metrics: [
        {
          label: "Employees on Leave",
          value: kpis.employeesOnLeaveCount || 0,
          to: "../list",
          filter: { ...baseFilter, onLeave: "true", ...periodFilter },
        },
        {
          label: "Prev. Period",
          value: deltaText(leaveDaysDelta),
          icon: deltaIcon(leaveDaysDelta),
        },
      ],
      title:
        "Sum of day_fraction across all HR2000 leave-ledger entries falling in the selected period (0.5/1.0 per entry), regardless of whether the employee also had real check-in data that same day. Employees on Leave is a distinct-employee count for the same period.",
    },
  ];
}
