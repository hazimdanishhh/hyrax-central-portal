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

// Mirrors getFinanceOverviewConfig's tile shape and previous-period delta
// pattern exactly (calcDelta -> "up/down X% vs last period" sub-metric).
export function getEmployeesOverviewConfig(
  kpis,
  tenureDistributionData = [],
  ageDistributionData = [],
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
      title:
        "Employees currently classified Active, Probation, On Leave, or Sabbatical. Total Workforce includes every status (Active, Terminated, Inactive) for context.",
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
      title:
        "Average length of service, in years, across all currently Active employees.",
    },
    {
      icon: CakeIcon,
      label: "Average Age",
      sublabel: "Active Employees (Today)",
      value: `${kpis.avgAgeYears || 0}y`,
      variant: "yellowCardFill",
      to: null,
      metrics: [
        {
          label: "Under 25",
          value: ageUnder25,
        },
        {
          label: "55+ (Nearing Retirement)",
          value: age55Plus,
        },
      ],
      title:
        "Average age, in years, across all currently Active employees with a recorded date_of_birth.",
    },
    // {
    //   icon: UsersThreeIcon,
    //   label: "Management Coverage",
    //   sublabel: "Active Employees With a Manager Assigned",
    //   value: `${kpis.managementCoveragePct || 0}%`,
    //   variant: "yellowCard",
    //   to: null,
    //   metrics: [
    //     {
    //       label: "With Manager",
    //       value: kpis.activeWithManager || 0,
    //     },
    //     {
    //       label: "Without Manager",
    //       value: (kpis.activeHeadcount || 0) - (kpis.activeWithManager || 0),
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
        {
          label: "Status Mismatch",
          value: kpis.statusMismatchCount || 0,
        },
      ],
      title:
        "Active employees missing manager_id, department_id, or profile_id -- click through to the Employee List, pre-filtered to employees with no manager assigned. The sub-counts can overlap (one employee can be missing more than one), so they don't need to sum to the headline count. Status Mismatch is separate: active employees moved off Probation status without ever being confirmed (confirmation_date still null), already past the 6-month mark from join_date.",
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
      title:
        "Employees whose join_date falls within the selected period (all-time if no range selected).",
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
      title:
        "Employees now classified Terminated/Resigned/Retired/Terminated Notice whose end_date (falling back to resignation_date) falls within the selected period.",
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
      variant: kpis.lateConfirmationsCount > 0 ? "redCard" : "blueCard",
      to: "../list?employmentStatus=3",
      metrics: [
        {
          label: "Confirmations Due Soon",
          value: kpis.confirmationsDueSoonCount || 0,
          icon: HourglassHighIcon,
        },
        {
          label: "Confirmations Overdue",
          value: kpis.lateConfirmationsCount || 0,
          icon: WarningCircleIcon,
        },
        {
          label: "Contracts Ending",
          value: kpis.contractActionsDueCount || 0,
        },
      ],
      title:
        "Confirmation is due 6 months after join_date (company policy). 'Due Soon' = still on Probation, unconfirmed, due within 30 days. 'Overdue' = still on Probation, unconfirmed, already past the 6-month mark. 'Contracts Ending' = contract-type employment with an end_date in the next 30 days.",
    },
  ];
}
