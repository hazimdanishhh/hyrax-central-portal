import {
  CalendarStarIcon,
  CalendarXIcon,
  GaugeIcon,
  HourglassHighIcon,
  SignInIcon,
  SignOutIcon,
  TrendDownIcon,
  TrendUpIcon,
  WarningCircleIcon,
  WarningOctagonIcon,
} from "@phosphor-icons/react";
import { getStatusVariant } from "../../../../../functions/statusVariant";
import { formatHours } from "../../../../../functions/formatDate";

// Restructured 2026-09-25, revised twice same day after review: each tile
// answers exactly one question, using OverviewCards' `metrics` sub-row
// capability the same way Employee Overview's "HR Actions Needed"/"Data
// Gaps" tiles do -- a tile's headline is the sum of its sub-metrics (except
// where noted), and each sub-metric still drills through independently.
// Current 8 tiles:
//
//   1. Attendance Rate       -- present vs. working-day records, colored by
//      ITS OWN rate (high-good) -- Absenteeism Rate folded in as of the
//      second revision: they're two readings of the same present/roster
//      data from opposite ends, so one color signal covers both instead of
//      two tiles telling nearly the same story. Absent Days + its delta are
//      now this tile's own sub-metrics.
//   2. Needs Reconciliation  -- records that need an HR decision: pending
//      approvals, leave conflicts, insufficient half-day hours, absences.
//      Its own "Absent" row is the same plain fact as Attendance Rate's own
//      Absent Days, just a different time window -- this row follows the
//      tile's own backlog-vs-period rule (is it STILL outstanding right
//      now), Absent Days follows Attendance Rate's This-Month/period rule
//      (how many absences happened this month). NOT Missing Check-Outs/
//      Incomplete Scans either (those are DATA QUALITY gaps -- incomplete
//      punch data -- not records needing a decision; see Data Quality
//      below). Headline is needs_reconciliation's own real 5-condition flag
//      from the view, a SUPERSET of the 4 rows shown (it also counts an
//      unapproved app-hours delta, not broken out here since Pending
//      Approvals is its practical proxy) -- deliberate, not a bug.
//   3. Average Check-In      -- what time, plus Late Arrivals. Colored by
//      its own late-arrival RATE, not a raw count.
//   4. Average Check-Out     -- what time, plus Early Leave. Colored by its
//      own early-leave RATE. Split from Check-In (was one merged
//      "Punctuality" tile) -- arriving late and leaving early are different
//      behaviors with different likely causes, and a merged count hid which
//      side was driving it.
//   5. Data Quality          -- Missing Check-Outs + Incomplete Card Scans:
//      punch data that's incomplete, as opposed to Needs Reconciliation's
//      "complete but needs a decision". Both rows now behave identically
//      (backlog when unfiltered, exact period once filtered) -- Incomplete
//      Card Scans used to default to TODAY specifically; that special case
//      is gone, since a stale incomplete scan needs the same follow-up
//      regardless of which date range is on screen.
//   6. Hours Worked          -- how MUCH ordinary-working-day time was
//      logged (Average Hours Worked + Overtime).
//   7. Non-Working-Day Hours -- Holiday + Weekend Work merged (same
//      calculation shape, mutually exclusive with Overtime by construction,
//      both answer "did anyone work when nobody was expected to").
//   8. Leave Days            -- total leave taken, paid/unpaid split.
//
// Filter matching + "This Month" default (see get_attendance_dashboard_rpc.sql's
// own header for the full 3-question rationale). Two families, both driven
// by the RPC's own kpis.* values (this file never re-derives them, just
// formats/labels what's already computed) -- department/employee always
// apply to both:
//
//   * REGULAR metrics (Attendance Rate/Absent, Check-In/Check-Out, Hours
//     Worked, Non-Working-Day Hours, Leave) default to THIS MONTH when no
//     date range is picked, and match the selected range exactly once one
//     is. `periodLabel`/`periodFilter` below.
//   * ACTIONABLE metrics (Needs Reconciliation and its 4 rows, Data
//     Quality's 2 rows) default to the TRUE CURRENT BACKLOG (unbounded by
//     date) when no range is picked, and switch to "originated in the
//     selected period" once one is chosen -- HR needs to see everything
//     still outstanding the moment they land on the page, not just what
//     happened to originate this month. `actionableLabel`/`actionableFilter`
//     below.
//
// Drill-through filters use `calendarType: "ordinary"` for "a normal working
// day" (DAY_CALENDAR_TYPE_OPTIONS' real value), not the legacy `dayType`
// param this file used until 2026-09-25 -- `dayType` still resolves (a
// backward-compat case in attendanceOverviewService.js) but isn't a
// selectable option in filterConfig.js anymore, so a link built from it
// pointed at a filter the UI itself doesn't expose.
//
// Drill-through pass: `filters` is the Overview's OWN active department/
// employee/period filters -- threaded into every link below so a tile click
// doesn't silently drop whatever the user had already narrowed down to.
export function getAttendanceOverviewConfig(
  kpis = {},
  isPeriodFiltered = false,
  filters = {},
) {
  const periodLabel = isPeriodFiltered ? "This Period" : "This Month";
  const actionableLabel = isPeriodFiltered ? "This Period" : "Current Backlog";

  const calcDelta = (current, previous) => {
    if (previous === null || previous === undefined) return null;
    if (previous === 0 && current === 0) return 0;
    if (previous === 0 && current > 0) return 100;

    return Math.round(((current - previous) / previous) * 100);
  };

  const deltaText = (delta) =>
    delta === null ? "" : delta > 0 ? `↑ ${delta}%` : `↓ ${Math.abs(delta)}%`;

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

  const avgHoursDelta = calcDelta(kpis.avgHoursWorked, kpis.prevAvgHoursWorked);
  const absentDaysDelta = calcDelta(
    kpis.absentDaysCount,
    kpis.prevAbsentDaysCount,
  );
  const overtimeDelta = calcDelta(
    kpis.overtimeHoursTotal,
    kpis.prevOvertimeHoursTotal,
  );
  const leaveDaysDelta = calcDelta(
    kpis.leaveDaysCount,
    kpis.prevLeaveDaysCount,
  );
  const unpaidLeaveDaysDelta = calcDelta(
    kpis.unpaidLeaveDaysCount,
    kpis.prevUnpaidLeaveDaysCount,
  );
  const holidayHoursWorkedDelta = calcDelta(
    kpis.holidayHoursWorkedTotal,
    kpis.prevHolidayHoursWorkedTotal,
  );
  const weekendHoursWorkedDelta = calcDelta(
    kpis.weekendHoursWorkedTotal,
    kpis.prevWeekendHoursWorkedTotal,
  );

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

  // REGULAR metrics -- always a concrete range: the selection, or This Month.
  const periodFilter = {
    startDate: filters.startDate || monthStart,
    endDate: filters.endDate || today,
  };

  // ACTIONABLE metrics -- omitted entirely when unfiltered (true backlog,
  // matching the RPC's own unbounded query), the exact selection otherwise.
  const actionableFilter = isPeriodFiltered
    ? { startDate: filters.startDate, endDate: filters.endDate }
    : {};

  // Dynamic tile severity (see docs/DASHBOARD-CONVENTIONS.md's "KPI Card
  // Color & Fill Convention"). Thresholds below are documented estimates,
  // not audited HR policy -- tune freely without touching statusVariant.js.
  const needsReconciliationCount = kpis.needsReconciliationCount || 0;
  const needsReconciliationStatus = getStatusVariant(needsReconciliationCount, {
    direction: "low-good",
    tiers: 2,
    badLevel: "critical",
    thresholds: { criticalAt: 1 },
  });
  const lateArrivalsCount = kpis.lateArrivalsCount || 0;
  const earlyLeaveCount = kpis.earlyLeaveCount || 0;
  // Split back into Average Check-In/Average Check-Out (2026-09-25 -- was one
  // merged "Punctuality" tile). Each tile's own color now comes from its OWN
  // rate, not a combined count -- a coaching matter rather than a crisis, so
  // worst tier stays "warning". Rate, not raw count: a flat count threshold
  // doesn't mean the same thing at 20 vs. 2,000 employees, and
  // lateArrivalRatePct/earlyLeaveRatePct are already computed against the
  // right denominator (working-day records). 10% is a documented estimate,
  // not audited policy -- tune freely.
  const lateArrivalStatus = getStatusVariant(kpis.lateArrivalRatePct || 0, {
    direction: "low-good",
    tiers: 2,
    badLevel: "warning",
    thresholds: { criticalAt: 10 },
  });
  const earlyLeaveStatus = getStatusVariant(kpis.earlyLeaveRatePct || 0, {
    direction: "low-good",
    tiers: 2,
    badLevel: "warning",
    thresholds: { criticalAt: 10 },
  });
  const missingCheckoutsCount = kpis.missingCheckoutsCount || 0;
  const incompleteScansCount = kpis.incompleteScansCount || 0;
  // Data Quality (2026-09-25, new -- see the discussion this replaces:
  // Missing Check-Outs/Incomplete Card Scans used to sit inside Needs
  // Reconciliation, but neither is one of needs_reconciliation's own 5 real
  // conditions -- both are "we don't have complete punch data" gaps, not "a
  // record exists and needs a decision"). Sum-of-sub-metrics headline, same
  // convention as Needs Reconciliation -- worst tier is "critical": missing
  // punch data blocks payroll the same way an unapproved activity does.
  const dataQualityCount = missingCheckoutsCount + incompleteScansCount;
  const dataQualityStatus = getStatusVariant(dataQualityCount, {
    direction: "low-good",
    tiers: 2,
    badLevel: "critical",
    thresholds: { criticalAt: 1 },
  });
  // hours_worked is the raw on-site span (clock-in to clock-out) and is
  // never reduced for the 1-hour unpaid lunch (see Overtime's own title
  // below: "8 paid hours means a 9-hour span, since the 1-hour unpaid lunch
  // sits inside it") -- so a normal, complete day reads as ~9 hours, not 8.
  // high-good (not target-band): only falling SHORT of a full day is a
  // concern here -- working longer than 9 hours is never penalized by this
  // tile, since that's exactly what the Overtime sub-metric already tracks
  // in its own right.
  const avgHoursWorkedStatus = getStatusVariant(kpis.avgHoursWorked, {
    direction: "high-good",
    thresholds: { warningAt: 8, goodAt: 9 },
  });
  const nonWorkingDayHoursTotal =
    (kpis.holidayHoursWorkedTotal || 0) + (kpis.weekendHoursWorkedTotal || 0);
  // Public holidays integration -- "any nonzero total" convention: a
  // payroll-relevant fact worth HR's attention, not necessarily a problem,
  // hence "warning" not "critical". 0.01 approximates "any nonzero" for a
  // continuous hours value.
  const nonWorkingDayHoursStatus = getStatusVariant(nonWorkingDayHoursTotal, {
    direction: "low-good",
    tiers: 2,
    badLevel: "warning",
    thresholds: { criticalAt: 0.01 },
  });
  // Attendance Rate's own color (2026-09-25 -- was static blue, with
  // Absenteeism Rate carrying the only dynamic color between the two).
  // high-good, not low-good-on-absenteeism: same underlying present/roster
  // data either way, this just reads it from the "bigger is better" side.
  // 90/95% are documented estimates, not audited HR policy.
  const attendanceRateStatus = getStatusVariant(kpis.attendanceRatePct || 0, {
    direction: "high-good",
    thresholds: { warningAt: 90, goodAt: 95 },
  });

  return [
    {
      icon: GaugeIcon,
      label: "Attendance Rate",
      sublabel: periodLabel,
      value: `${kpis.attendanceRatePct || 0}%`,
      variant: attendanceRateStatus.variant,
      status: {
        icon: attendanceRateStatus.statusIcon,
        label: attendanceRateStatus.statusLabel,
      },
      // The rate's own denominator population (all working-day records) --
      // matches Working-Day Records' own sub-metric below.
      to: "../list",
      filter: { ...baseFilter, calendarType: "ordinary", ...periodFilter },
      metrics: [
        {
          label: "Present",
          value: kpis.presentPeriodCount || 0,
          to: "../list",
          filter: { ...baseFilter, presentOnly: "true", ...periodFilter },
        },
        {
          label: "Working-Day Records",
          value: kpis.workingDayRecordsCount || 0,
          to: "../list",
          filter: { ...baseFilter, calendarType: "ordinary", ...periodFilter },
        },
        {
          label: "Absent Days",
          value: kpis.absentDaysCount || 0,
          to: "../list",
          filter: { ...baseFilter, dayState: "absent", ...periodFilter },
        },
        {
          label: "Absent, Prev. Period",
          value: deltaText(absentDaysDelta),
          icon: deltaIcon(absentDaysDelta),
        },
      ],
      title:
        "How many employees checked in, compared to how many were expected to work -- and how many were absent.",
    },

    {
      icon: SignInIcon,
      label: "Average Check-In",
      sublabel: periodLabel,
      value: formatTimeDisplay(kpis.avgCheckInTime),
      variant: lateArrivalStatus.variant,
      status: {
        icon: lateArrivalStatus.statusIcon,
        label: lateArrivalStatus.statusLabel,
      },
      to: "../list",
      filter: { ...baseFilter, calendarType: "ordinary", ...periodFilter },
      metrics: [
        {
          label: "Late Arrivals",
          value: `${lateArrivalsCount} (${kpis.lateArrivalRatePct || 0}%)`,
          to: "../list",
          filter: { ...baseFilter, lateArrival: "true", ...periodFilter },
        },
      ],
      title: "Average first check-in time, and how often people arrived late.",
    },

    {
      icon: SignOutIcon,
      label: "Average Check-Out",
      sublabel: periodLabel,
      value: formatTimeDisplay(kpis.avgCheckOutTime),
      variant: earlyLeaveStatus.variant,
      status: {
        icon: earlyLeaveStatus.statusIcon,
        label: earlyLeaveStatus.statusLabel,
      },
      to: "../list",
      filter: { ...baseFilter, calendarType: "ordinary", ...periodFilter },
      metrics: [
        {
          label: "Early Leave",
          value: `${earlyLeaveCount} (${kpis.earlyLeaveRatePct || 0}%)`,
          to: "../list",
          filter: { ...baseFilter, earlyLeave: "true", ...periodFilter },
        },
      ],
      title: "Average last check-out time, and how often people left early.",
    },

    {
      icon: HourglassHighIcon,
      label: "Hours Worked",
      sublabel: periodLabel,
      value: formatHours(kpis.avgHoursWorked) || 0,
      subvalue: deltaText(avgHoursDelta),
      variant: avgHoursWorkedStatus.variant,
      status: {
        icon: avgHoursWorkedStatus.statusIcon,
        label: avgHoursWorkedStatus.statusLabel,
      },
      to: "../list",
      filter: { ...baseFilter, calendarType: "ordinary", ...periodFilter },
      metrics: [
        {
          label: "Overtime Hours",
          value: formatHours(kpis.overtimeHoursTotal),
          icon: deltaIcon(overtimeDelta),
          to: "../list",
          filter: { ...baseFilter, overtimeOnly: "true", ...periodFilter },
        },
        {
          label: "Employees With Overtime",
          value: kpis.employeesWithOvertimeCount || 0,
          to: "../list",
          filter: { ...baseFilter, overtimeOnly: "true", ...periodFilter },
        },
      ],
      title: "Average hours worked per day, plus total overtime.",
    },

    // Public holidays integration -- reconciliation metric for employees who
    // actually attended on a day nobody was expected to work. MUTUALLY
    // EXCLUSIVE with Overtime above, by construction: holiday and weekend
    // work is paid under its own rest-day/holiday rate tiers (Employment Act
    // s.60(3)/s.60D(3)), never as normal-day overtime, so
    // unified_daily_attendance forces overtime_hours to 0 on those days. The
    // same day can never contribute to both tiles.
    {
      icon: CalendarStarIcon,
      label: "Non-Working-Day Hours",
      sublabel: `${periodLabel}`,
      value: formatHours(nonWorkingDayHoursTotal),
      variant: nonWorkingDayHoursStatus.variant,
      status: {
        icon: nonWorkingDayHoursStatus.statusIcon,
        label: nonWorkingDayHoursStatus.statusLabel,
      },
      to: null,
      metrics: [
        {
          label: "Holiday Hours",
          value: formatHours(kpis.holidayHoursWorkedTotal),
          icon: deltaIcon(holidayHoursWorkedDelta),
          to: "../list",
          filter: { ...baseFilter, workedOnHoliday: "true", ...periodFilter },
        },
        {
          label: "Employees Worked (Holiday)",
          value: kpis.employeesWorkedOnHolidayCount || 0,
          to: "../list",
          filter: { ...baseFilter, workedOnHoliday: "true", ...periodFilter },
        },
        {
          label: "Weekend Hours",
          value: formatHours(kpis.weekendHoursWorkedTotal),
          icon: deltaIcon(weekendHoursWorkedDelta),
          to: "../list",
          filter: { ...baseFilter, workedOnWeekend: "true", ...periodFilter },
        },
        {
          label: "Employees Worked (Weekend)",
          value: kpis.employeesWorkedOnWeekendCount || 0,
          to: "../list",
          filter: { ...baseFilter, workedOnWeekend: "true", ...periodFilter },
        },
      ],
      title: "Hours worked on public holidays or weekends.",
    },

    // ==========================================
    // LEAVE (period-bound) -- HR2000 leave ledger integration. Never a
    // "problem" figure, so it never gets a status-variant color -- a plain
    // neutral tile.
    // ==========================================
    {
      icon: CalendarXIcon,
      label: "Leave Days",
      sublabel: `${periodLabel}`,
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
        // Paid vs. unpaid split, for payroll prep -- CAVEAT: sourced from
        // leave_ledger_types.is_paid, itself an unconfirmed guess for
        // nearly every leave type today (needs_hr_confirmation), pending
        // real HR/payroll sign-off. Shown at face value with no warning
        // icon here, per an explicit decision to match this codebase's
        // existing convention of disclosing this kind of assumption only
        // in code comments (see get_attendance_dashboard_rpc.sql).
        {
          label: "Unpaid Leave Days",
          value: kpis.unpaidLeaveDaysCount || 0,
        },
        {
          label: "Total vs Prev. Period",
          value: deltaText(leaveDaysDelta),
          icon: deltaIcon(leaveDaysDelta),
        },
        {
          label: "Unpaid vs Prev. Period",
          value: deltaText(unpaidLeaveDaysDelta),
          icon: deltaIcon(unpaidLeaveDaysDelta),
        },
      ],
      title: "Total leave days taken, including how many were unpaid.",
    },

    // Data Quality (2026-09-25, new) -- "we don't have complete punch data",
    // distinct from Needs Reconciliation's "a record exists and needs a
    // decision". See dataQualityCount's own comment above.
    {
      icon: WarningOctagonIcon,
      label: "Data Quality",
      sublabel: actionableLabel,
      value: dataQualityCount,
      variant: dataQualityStatus.variant,
      status: {
        icon: dataQualityStatus.statusIcon,
        label: dataQualityStatus.statusLabel,
      },
      to: null,
      metrics: [
        {
          label: "Missing Check-Outs",
          value: missingCheckoutsCount,
          to: "../list",
          filter: {
            ...baseFilter,
            evidenceQuality: "open_session",
            ...actionableFilter,
          },
        },
        {
          label: "Incomplete Card Scans",
          value: incompleteScansCount,
          to: "../list",
          filter: {
            ...baseFilter,
            evidenceQuality: "single_scan",
            ...actionableFilter,
          },
        },
      ],
      title:
        "Punch data that's incomplete: open app sessions with no check-out, and single hardware scans with no matching pair.",
    },

    {
      icon: WarningCircleIcon,
      label: "Needs Reconciliation",
      sublabel: actionableLabel,
      value: needsReconciliationCount,
      variant: needsReconciliationStatus.variant,
      status: {
        icon: needsReconciliationStatus.statusIcon,
        label: needsReconciliationStatus.statusLabel,
      },
      to: "../list",
      filter: {
        ...baseFilter,
        needsReconciliation: "true",
        ...actionableFilter,
      },
      // Deliberately NOT Missing Check-Outs/Incomplete Card Scans/Unapproved
      // Hours Delta -- Missing Check-Outs/Incomplete Card Scans are DATA-
      // QUALITY gaps (we don't have complete punch data), not RECONCILIATION
      // items (a record exists and needs a decision) -- see Data Quality
      // instead. Unapproved Hours Delta dropped because Pending Approvals is
      // its practical cause/proxy (an activity sits as app_hours but not
      // approved_app_hours specifically because it's Pending) -- showing
      // both would be the same underlying fact twice. The "Absent" row below
      // reads the same plain day_state = 'absent' fact Attendance Rate's own
      // Absent Days does -- see that row's own comment below for why an
      // absence needs no separate acknowledgement flag here.
      //
      // NOTE: the headline above (needsReconciliationCount) is the view's
      // real 5-condition needs_reconciliation flag, which counts only
      // UNACKNOWLEDGED absences (is_unacknowledged_absent) and the
      // unapproved-hours delta -- both narrower than/different from what
      // this tile's own Absent/Pending Approvals rows show. So the headline
      // will not exactly equal the sum of the rows below. Deliberate, not a
      // bug: this still keeps the headline as the one true "does this need
      // review at all" figure (matching the List page's own identically-named
      // tile), while the visible breakdown stays to the kinds that are
      // genuinely distinct questions.
      metrics: [
        {
          label: "Pending Approvals",
          value: kpis.pendingApprovalsCount || 0,
          to: "../list",
          filter: {
            ...baseFilter,
            approvalState: "pending",
            ...actionableFilter,
          },
        },
        {
          label: "Leave Conflicts",
          value: kpis.leaveConflictCount || 0,
          to: "../list",
          filter: {
            ...baseFilter,
            leaveAttendanceConflict: "true",
            ...actionableFilter,
          },
        },
        {
          label: "Insufficient Half-Day Hours",
          value: kpis.insufficientHalfDayCount || 0,
          to: "../list",
          filter: {
            ...baseFilter,
            insufficientHalfDayHours: "unresolved",
            ...actionableFilter,
          },
        },
        // Same plain day_state = 'absent' fact Attendance Rate's own "Absent
        // Days" sub-metric reads -- an absence is considered needing
        // reconciliation regardless of any separate acknowledgement state,
        // so there's no separate flag/filter for it. The only difference
        // from Attendance Rate's version is the time window: this follows
        // the backlog family like every other row in this tile (is it
        // STILL outstanding right now, regardless of which date range is on
        // screen), Attendance Rate follows This-Month/period (how many
        // absences happened this month). Reuses the exact same `dayState`
        // filter Attendance Rate's own Absent Days row does.
        {
          label: "Absent",
          value: kpis.absentBacklogCount || 0,
          to: "../list",
          filter: { ...baseFilter, dayState: "absent", ...actionableFilter },
        },
      ],
      title:
        "Records that need HR's attention: pending approvals, leave conflicts, insufficient half-day hours, and absences.",
    },
  ];
}
