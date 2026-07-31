import {
  UsersFourIcon,
  UsersThreeIcon,
  UserCircleDashedIcon,
  UserCirclePlusIcon,
  UserMinusIcon,
  HourglassHighIcon,
  CakeIcon,
  GaugeIcon,
  CalendarIcon,
  TrendUpIcon,
  TrendDownIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { getStatusVariant } from "../../../../../functions/statusVariant";

// Mirrors getFinanceOverviewConfig's tile shape and previous-period delta
// pattern exactly (calcDelta -> "up/down X% vs last period" sub-metric).
//
// Drill-through pass: every tile/sub-metric below is built to reproduce the
// EXACT row-set the number it's attached to represents, using the filter
// keys added to employeesService.js's fetchEmployees() in this same pass
// (statusBucket, manager/profile __notnull__, confirmationStatus,
// contractEndingSoon, ageBand/tenureBand, hire-date range via
// enableDateRange, departureDateFrom/To, excludeEmploymentStatus). Where a
// tile's headline number is an OR of several unrelated reasons (Data Gaps,
// HR Actions Needed) or a ratio/snapshot with no matching row-set (Attrition
// Rate, and Average Tenure/Age's averages themselves), the tile's own `to`
// stays null rather than link to a row-set that would misrepresent the
// number -- each such tile's INDIVIDUAL sub-metrics are independently
// correct instead, using the sub-metric click support added to
// OverviewCards.jsx in this same pass.
export function getEmployeesOverviewConfig(
  kpis,
  tenureDistributionData = [],
  ageDistributionData = [],
  filters = {},
) {
  // "New (<1yr)" / "10+ Years" pull from the already-computed tenure bands
  // (tenureDistributionData) instead of duplicating the same join_date
  // banding logic a second time in the RPC.
  const tenureUnder1Year =
    tenureDistributionData.find((d) => d.name === "< 1 year")?.value || 0;
  const tenure10PlusYears =
    tenureDistributionData.find((d) => d.name === "10+ years")?.value || 0;

  // Same technique for the age bands -- "Under 25" and "55+" (nearing
  // retirement) pulled from ageDistributionData instead of a second RPC field.
  const ageUnder25 =
    ageDistributionData.find((d) => d.name === "< 25")?.value || 0;
  const age55Plus =
    ageDistributionData.find((d) => d.name === "55+")?.value || 0;

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

  const hiresDelta = calcDelta(kpis.hiresInPeriod, kpis.prevHiresInPeriod);
  const departuresDelta = calcDelta(
    kpis.departuresInPeriod,
    kpis.prevDeparturesInPeriod,
  );

  // The RPC's period-bound KPIs (hiresInPeriod/departuresInPeriod/etc.)
  // default to ALL-TIME when the Overview has no period filter set (its own
  // tile tooltips say so) -- these link objects mirror that exactly:
  // omitted keys mean "no date constraint", not "today". join_date uses the
  // same startDate/endDate keys enableDateRange already sends; departure
  // date uses the dedicated departureDateFrom/To pair (both required
  // together by fetchEmployees).
  const hirePeriodFilter = {};
  if (filters?.startDate) hirePeriodFilter.startDate = filters.startDate;
  if (filters?.endDate) hirePeriodFilter.endDate = filters.endDate;

  const departurePeriodFilter = {};
  if (filters?.startDate && filters?.endDate) {
    departurePeriodFilter.departureDateFrom = filters.startDate;
    departurePeriodFilter.departureDateTo = filters.endDate;
  }

  const currentYearStart = `${new Date().getFullYear()}-01-01`;
  const today = new Date().toISOString().slice(0, 10);

  // Dynamic tile severity (see docs/DASHBOARD-CONVENTIONS.md's "KPI Card
  // Color & Fill Convention"). Thresholds below are documented estimates,
  // not audited HR policy -- tune freely without touching statusVariant.js.
  const dataGapsStatus = getStatusVariant(kpis.dataGapsCount || 0, {
    direction: "low-good",
    tiers: 2,
    badLevel: "critical",
    thresholds: { criticalAt: 1 },
  });
  // Delta-as-value: departuresDelta is % change vs the prior period, not the
  // raw count -- color follows the trend, not a fixed "departures = bad".
  const departuresStatus = getStatusVariant(departuresDelta, {
    direction: "low-good",
    thresholds: { warningAt: 1, criticalAt: 21 },
  });
  const attritionStatus = getStatusVariant(kpis.attritionRatePct || 0, {
    direction: "low-good",
    thresholds: { warningAt: 2, criticalAt: 4 },
  });
  // Multi-field OR condition collapsed into one severity score (2 = an
  // overdue confirmation exists, 1 = something's merely upcoming, 0 = clear)
  // so it can still route through the shared tiering/fill logic. The safe
  // branch is "good" (green), not blue -- a blue safe-branch here would be an
  // unearned "informational" claim on a tile that's actively evaluating.
  const hrActionsSeverity =
    kpis.lateConfirmationsCount > 0
      ? 2
      : kpis.confirmationsDueSoonCount > 0 || kpis.contractActionsDueCount > 0
        ? 1
        : 0;
  const hrActionsStatus = getStatusVariant(hrActionsSeverity, {
    direction: "low-good",
    thresholds: { warningAt: 1, criticalAt: 2 },
  });

  return [
    // ==========================================
    // WORKFORCE SNAPSHOT (point-in-time)
    // ==========================================

    {
      icon: UsersFourIcon,
      label: "Active Headcount",
      sublabel: "Active Employees (Today)",
      value: kpis.activeHeadcount || 0,
      variant: "blueCardFill",
      to: "../list",
      filter: { statusBucket: "active" },
      metrics: [
        {
          label: "On Probation",
          value: kpis.probationCount || 0,
          to: "../list",
          filter: { employmentStatus: 3 },
        },
        {
          label: "Total Workforce",
          value: kpis.totalWorkforceCount || 0,
          to: "../list",
        },
      ],
      title:
        "Employees currently classified Active, Probation, On Leave, or Sabbatical. Total Workforce includes every status (Active, Terminated, Inactive) for context.",
    },
    {
      icon: HourglassHighIcon,
      label: "Average Tenure",
      sublabel: "Active Employees (Today)",
      value: `${kpis.avgTenureYears || 0}y`,
      // Informational -- no documented retention-risk floor to evaluate
      // against. Blue, not green: this tile isn't making a good/bad claim.
      variant: "blueCard",
      // An average has no exact matching row-set -- links to the active
      // population it's averaged over, the best available "see who" target.
      to: "../list",
      filter: { statusBucket: "active" },
      metrics: [
        {
          label: "New (<1yr)",
          value: tenureUnder1Year,
          to: "../list",
          filter: { statusBucket: "active", tenureBand: "< 1 year" },
        },
        {
          label: "10+ Years",
          value: tenure10PlusYears,
          to: "../list",
          filter: { statusBucket: "active", tenureBand: "10+ years" },
        },
      ],
      title:
        "Average length of service, in years, across all currently Active employees.",
    },
    {
      icon: CakeIcon,
      label: "Average Age",
      sublabel: "Active Employees (Today)",
      value: `${kpis.avgAgeYears || 0}y`,
      // Informational, defaulting to neutral pending confirmation: it's
      // genuinely unclear whether an aging workforce is a real concern here
      // (succession/retirement risk) or a pure demographic fact -- ships
      // blue, never a guessed warning color, until HR weighs in.
      variant: "blueCard",
      to: "../list",
      filter: { statusBucket: "active" },
      metrics: [
        {
          label: "Under 25",
          value: ageUnder25,
          to: "../list",
          filter: { statusBucket: "active", ageBand: "< 25" },
        },
        {
          label: "55+ (Nearing Retirement)",
          value: age55Plus,
          to: "../list",
          filter: { statusBucket: "active", ageBand: "55+" },
        },
      ],
      title:
        "Average age, in years, across all currently Active employees with a recorded date_of_birth.",
    },
    // Disabled -- left off by product decision, not re-enabled as part of
    // the drill-through pass. Data/filters kept correct below so it's ready
    // whenever someone does decide to turn it back on.
    // {
    //   icon: UsersThreeIcon,
    //   label: "Management Coverage",
    //   sublabel: "Active Employees With a Manager Assigned",
    //   value: `${kpis.managementCoveragePct || 0}%`,
    //   variant: "yellowCard",
    //   to: "../list",
    //   filter: { statusBucket: "active", manager: "__notnull__" },
    //   metrics: [
    //     {
    //       label: "With Manager",
    //       value: kpis.activeWithManager || 0,
    //       to: "../list",
    //       filter: { statusBucket: "active", manager: "__notnull__" },
    //     },
    //     {
    //       label: "Without Manager",
    //       value: (kpis.activeHeadcount || 0) - (kpis.activeWithManager || 0),
    //       to: "../list",
    //       filter: { statusBucket: "active", manager: "__null__" },
    //     },
    //     {
    //       label: "Avg Team Size",
    //       value: kpis.avgSpanOfControl || 0,
    //     },
    //   ],
    //   title:
    //     "Share of Active employees who have a manager_id assigned. Avg Team Size is the average number of active direct reports per active manager.",
    // },
    {
      icon: UserCircleDashedIcon,
      label: "Data Gaps",
      sublabel: "Missing Manager, Department, or Profile Link",
      value: kpis.dataGapsCount || 0,
      variant: dataGapsStatus.variant,
      status: { icon: dataGapsStatus.statusIcon, label: dataGapsStatus.statusLabel },
      // The headline is an OR of 4 independent reasons -- no single filter
      // reproduces it faithfully (the previous manager=__null__-only link
      // both dropped 3 of the 4 reasons and wasn't active-bucket-scoped).
      // Each reason is independently correct as its own sub-metric instead.
      to: null,
      metrics: [
        {
          label: "No Manager",
          value: kpis.noManagerCount || 0,
          to: "../list",
          filter: { statusBucket: "active", manager: "__null__" },
        },
        {
          label: "No Department",
          value: kpis.noDepartmentCount || 0,
          to: "../list",
          filter: { statusBucket: "active", department: "__null__" },
        },
        {
          label: "No Profile",
          value: kpis.noProfileCount || 0,
          to: "../list",
          filter: { statusBucket: "active", profile: "__null__" },
        },
        {
          label: "Status Mismatch",
          value: kpis.statusMismatchCount || 0,
          to: "../list",
          filter: {
            statusBucket: "active",
            confirmationStatus: "overdue",
            excludeEmploymentStatus: 3,
          },
        },
      ],
      title:
        "Active employees missing manager_id, department_id, or profile_id -- each sub-metric links to that specific reason. The sub-counts can overlap (one employee can be missing more than one), so they don't need to sum to the headline count. Status Mismatch is separate: active employees moved off Probation status without ever being confirmed (confirmation_date still null), already past the 6-month mark from join_date.",
    },

    // ==========================================
    // MOVEMENT & UPCOMING ACTIONS (period-bound)
    // ==========================================

    {
      icon: UserCirclePlusIcon,
      label: "New Hires",
      sublabel: "Joined This Period",
      value: kpis.hiresInPeriod || 0,
      // Informational -- "more hires" isn't inherently good/bad without a
      // hiring plan to evaluate against.
      variant: "blueCard",
      to: "../list",
      filter: hirePeriodFilter,
      metrics: [
        {
          label: "Prev. Period",
          value: deltaText(hiresDelta),
          icon: deltaIcon(hiresDelta),
          // A delta has no matching row-set -- not linked.
        },
        {
          label: "YTD",
          value: kpis.ytdHiresCount || 0,
          to: "../list",
          filter: { startDate: currentYearStart },
        },
      ],
      title:
        "Employees whose join_date falls within the selected period (all-time if no range selected).",
    },
    {
      icon: UserMinusIcon,
      label: "Departures",
      sublabel: "Left This Period",
      value: kpis.departuresInPeriod || 0,
      variant: departuresStatus.variant,
      status: { icon: departuresStatus.statusIcon, label: departuresStatus.statusLabel },
      to: "../list",
      filter: { statusBucket: "terminated", ...departurePeriodFilter },
      metrics: [
        {
          label: "Prev. Period",
          value: deltaText(departuresDelta),
          icon: deltaIcon(departuresDelta),
        },
        {
          label: "YTD",
          value: kpis.ytdDeparturesCount || 0,
          to: "../list",
          filter: {
            statusBucket: "terminated",
            departureDateFrom: currentYearStart,
            departureDateTo: today,
          },
        },
      ],
      title:
        "Employees now classified Terminated/Resigned/Retired/Terminated Notice whose end_date (falling back to resignation_date) falls within the selected period.",
    },
    {
      icon: GaugeIcon,
      label: "Attrition Rate",
      sublabel: "Departures vs Average Headcount, This Period",
      value: `${kpis.attritionRatePct || 0}%`,
      variant: attritionStatus.variant,
      status: { icon: attritionStatus.statusIcon, label: attritionStatus.statusLabel },
      // A ratio has no matching row-set -- was already correctly unlinked,
      // not a bug.
      to: null,
      metrics: [
        {
          label: "Departures",
          value: kpis.departuresInPeriod || 0,
        },
        {
          label: "Avg Headcount",
          value: kpis.avgHeadcount || 0,
        },
      ],
      title:
        "Departures this period divided by average headcount (beginning + ending headcount, reconstructed exactly from join_date/end_date or resignation_date, divided by 2) -- assumes end_date or resignation_date is reliably populated whenever an employee separates.",
    },
    {
      icon: CalendarIcon,
      label: "HR Actions Needed",
      sublabel: "Confirmations, Overdue Items & Contract Renewals",
      value:
        (kpis.confirmationsDueSoonCount || 0) +
        (kpis.lateConfirmationsCount || 0) +
        (kpis.contractActionsDueCount || 0),
      variant: hrActionsStatus.variant,
      status: { icon: hrActionsStatus.statusIcon, label: hrActionsStatus.statusLabel },
      // Same OR-of-unrelated-cohorts issue as Data Gaps -- the previous
      // employmentStatus=3-only link dumped every Probation employee
      // (most not due/overdue at all) and omitted Contracts Ending
      // entirely. Each cohort is its own correct sub-metric instead.
      to: null,
      metrics: [
        {
          label: "Confirmations Due Soon",
          value: kpis.confirmationsDueSoonCount || 0,
          icon: HourglassHighIcon,
          to: "../list",
          filter: { employmentStatus: 3, confirmationStatus: "due_soon" },
        },
        {
          label: "Confirmations Overdue",
          value: kpis.lateConfirmationsCount || 0,
          icon: WarningCircleIcon,
          to: "../list",
          filter: { employmentStatus: 3, confirmationStatus: "overdue" },
        },
        {
          label: "Contracts Ending",
          value: kpis.contractActionsDueCount || 0,
          to: "../list",
          filter: { statusBucket: "active", contractEndingSoon: "30" },
        },
      ],
      title:
        "Confirmation is due 6 months after join_date (company policy). 'Due Soon' = still on Probation, unconfirmed, due within 30 days. 'Overdue' = still on Probation, unconfirmed, already past the 6-month mark. 'Contracts Ending' = contract-type employment with an end_date in the next 30 days.",
    },
  ];
}
