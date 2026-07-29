import {
  UsersFourIcon,
  UsersThreeIcon,
  UserCircleDashedIcon,
  UserCirclePlusIcon,
  UserMinusIcon,
  HourglassHighIcon,
  GaugeIcon,
  CalendarIcon,
  TrendUpIcon,
  TrendDownIcon,
} from "@phosphor-icons/react";

// Mirrors getFinanceOverviewConfig's tile shape and previous-period delta
// pattern exactly (calcDelta -> "up/down X% vs last period" sub-metric).
export function getEmployeesOverviewConfig(kpis, tenureDistributionData = []) {
  // "New (<1yr)" / "10+ Years" pull from the already-computed tenure bands
  // (tenureDistributionData) instead of duplicating the same join_date
  // banding logic a second time in the RPC.
  const tenureUnder1Year =
    tenureDistributionData.find((d) => d.name === "< 1 year")?.value || 0;
  const tenure10PlusYears =
    tenureDistributionData.find((d) => d.name === "10+ years")?.value || 0;

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
      to: null,
      metrics: [
        {
          label: "On Probation",
          value: kpis.probationCount || 0,
        },
        {
          label: "Total Workforce",
          value: kpis.totalWorkforceCount || 0,
        },
      ],
      title: "Employees currently classified Active, Probation, On Leave, or Sabbatical. Total Workforce includes every status (Active, Terminated, Inactive) for context.",
    },
    {
      icon: HourglassHighIcon,
      label: "Average Tenure",
      sublabel: "Active Employees (Today)",
      value: `${kpis.avgTenureYears || 0}y`,
      variant: "greenCard",
      to: null,
      metrics: [
        {
          label: "New (<1yr)",
          value: tenureUnder1Year,
        },
        {
          label: "10+ Years",
          value: tenure10PlusYears,
        },
      ],
      title: "Average length of service, in years, across all currently Active employees.",
    },
    {
      icon: UsersThreeIcon,
      label: "Management Coverage",
      sublabel: "Active Employees With a Manager Assigned",
      value: `${kpis.managementCoveragePct || 0}%`,
      variant: "yellowCard",
      to: null,
      metrics: [
        {
          label: "With Manager",
          value: kpis.activeWithManager || 0,
        },
        {
          label: "Without Manager",
          value: (kpis.activeHeadcount || 0) - (kpis.activeWithManager || 0),
        },
      ],
      title: "Share of Active employees who have a manager_id assigned.",
    },
    {
      icon: UserCircleDashedIcon,
      label: "Data Gaps",
      sublabel: "Missing Manager, Department, or Profile Link",
      value: kpis.dataGapsCount || 0,
      variant: kpis.dataGapsCount > 0 ? "redCard" : "greenCard",
      to: "../list?manager=__null__",
      metrics: [
        {
          label: "No Manager",
          value: kpis.noManagerCount || 0,
        },
        {
          label: "No Department",
          value: kpis.noDepartmentCount || 0,
        },
        {
          label: "No Profile",
          value: kpis.noProfileCount || 0,
        },
      ],
      title: "Active employees missing manager_id, department_id, or profile_id -- click through to the Employee List, pre-filtered to employees with no manager assigned. The three sub-counts can overlap (one employee can be missing more than one), so they don't need to sum to the headline count.",
    },

    // ==========================================
    // MOVEMENT & UPCOMING ACTIONS (period-bound)
    // ==========================================

    {
      icon: UserCirclePlusIcon,
      label: "New Hires",
      sublabel: "Joined This Period",
      value: kpis.hiresInPeriod || 0,
      variant: "greenCard",
      to: null,
      metrics: [
        {
          label: "Prev. Period",
          value: deltaText(hiresDelta),
          icon: deltaIcon(hiresDelta),
        },
        {
          label: "YTD",
          value: kpis.ytdHiresCount || 0,
        },
      ],
      title: "Employees whose join_date falls within the selected period (all-time if no range selected).",
    },
    {
      icon: UserMinusIcon,
      label: "Departures",
      sublabel: "Left This Period",
      value: kpis.departuresInPeriod || 0,
      variant: "redCard",
      to: null,
      metrics: [
        {
          label: "Prev. Period",
          value: deltaText(departuresDelta),
          icon: deltaIcon(departuresDelta),
        },
        {
          label: "YTD",
          value: kpis.ytdDeparturesCount || 0,
        },
      ],
      title: "Employees now classified Terminated/Resigned/Retired/Terminated Notice whose end_date (falling back to resignation_date) falls within the selected period.",
    },
    {
      icon: GaugeIcon,
      label: "Attrition Rate",
      sublabel: "Departures vs Average Headcount, This Period",
      value: `${kpis.attritionRatePct || 0}%`,
      variant: "yellowCard",
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
      title: "Departures this period divided by average headcount (beginning + ending headcount, reconstructed exactly from join_date/end_date or resignation_date, divided by 2) -- assumes end_date or resignation_date is reliably populated whenever an employee separates.",
    },
    {
      icon: CalendarIcon,
      label: "Upcoming HR Actions",
      sublabel: "Due in the Next 30 Days",
      value: (kpis.confirmationsDueCount || 0) + (kpis.contractActionsDueCount || 0),
      variant: "blueCard",
      to: null,
      metrics: [
        {
          label: "Confirmations Due",
          value: kpis.confirmationsDueCount || 0,
        },
        {
          label: "Contracts Ending",
          value: kpis.contractActionsDueCount || 0,
        },
      ],
      title: "Active employees with a confirmation_date (probation) or, for contract-type employment, an end_date, falling within the next 30 days.",
    },
  ];
}
