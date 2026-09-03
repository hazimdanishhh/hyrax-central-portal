// pages/user/hr/hrReports/overviewConfig.js
//
// HR Reports' 8 headline tiles -- one clean "state of the org" signal per
// theme (Employees, Attendance, Leave, Lifecycle), deliberately
// non-overlapping with the "Needs Attention" section's overdue/stuck
// framing below it on the page. Mirrors Sales Reports' overviewConfig.js
// convention of taking the target routes' canAccess() result as a param
// rather than hardcoding link visibility.
import {
  AlarmIcon,
  CalendarIcon,
  CalendarXIcon,
  GaugeIcon,
  ListChecksIcon,
  UserCirclePlusIcon,
  UserCircleDashedIcon,
  UserMinusIcon,
  UsersFourIcon,
} from "@phosphor-icons/react";
import { getStatusVariant } from "../../../../functions/statusVariant";

export function getHrReportsOverviewConfig(
  kpis = {},
  canAccessHrOps = false,
  filters = {},
) {
  const baseFilter = {
    ...(filters.department && { department: filters.department }),
  };
  const periodFilter = {
    ...(filters.startDate && { startDate: filters.startDate }),
    ...(filters.endDate && { endDate: filters.endDate }),
  };
  const employeesTo = canAccessHrOps ? "/app/hr/employees/list" : undefined;
  const attendanceTo = canAccessHrOps ? "/app/hr/attendance/list" : undefined;
  const onboardingTo = canAccessHrOps ? "/app/hr/onboarding" : undefined;
  const offboardingTo = canAccessHrOps ? "/app/hr/offboarding" : undefined;

  // Same thresholds already tuned/shipped on Employee Overview/Attendance
  // Overview's own equivalent tiles -- kept identical so a number reads the
  // same severity wherever it appears in the app.
  const attritionStatus = getStatusVariant(kpis.attritionRatePct || 0, {
    direction: "low-good",
    thresholds: { warningAt: 2, criticalAt: 4 },
  });
  const absenteeismStatus = getStatusVariant(kpis.absenteeismRatePct || 0, {
    direction: "low-good",
    thresholds: { warningAt: 3, criticalAt: 6 },
  });
  const overtimeStatus = getStatusVariant(kpis.overtimeHoursTotal || 0, {
    direction: "low-good",
    tiers: 2,
    badLevel: "warning",
    thresholds: { criticalAt: 0.01 },
  });

  return [
    {
      icon: UsersFourIcon,
      label: "Active Headcount",
      sublabel: "Active Employees (Today)",
      value: kpis.activeHeadcount || 0,
      variant: "blueCardFill",
      to: employeesTo,
      filter: { ...baseFilter, statusBucket: "active" },
      metrics: [
        {
          label: "New Hires",
          value: kpis.hiresInPeriod || 0,
          to: employeesTo,
          filter: { ...baseFilter, ...periodFilter },
        },
        {
          label: "Departures",
          value: kpis.departuresInPeriod || 0,
          to: employeesTo,
          filter: { ...baseFilter, statusBucket: "terminated", ...periodFilter },
        },
      ],
      title:
        "Employees currently classified Active, Probation, On Leave, or Sabbatical -- company-wide, or within the selected department.",
    },
    {
      icon: GaugeIcon,
      label: "Attrition Rate",
      sublabel: "This Period",
      value: `${kpis.attritionRatePct || 0}%`,
      variant: attritionStatus.variant,
      status: { icon: attritionStatus.statusIcon, label: attritionStatus.statusLabel },
      to: null,
      metrics: [{ label: "Departures", value: kpis.departuresInPeriod || 0 }],
      title:
        "Departures this period divided by average headcount (beginning + ending headcount / 2), same formula as Employee Overview's own Attrition Rate tile.",
    },
    {
      icon: GaugeIcon,
      label: "Attendance Rate",
      sublabel: "This Period, Company-Wide",
      value: `${kpis.attendanceRatePct || 0}%`,
      variant: "blueCard",
      to: attendanceTo,
      filter: { ...baseFilter, workingDayOnly: "true", ...periodFilter },
      metrics: [],
      title:
        "Employees with any real check-in data, divided by working-day records (Weekend/Rest-Day excluded), this period -- same formula as Attendance Overview's headline rate.",
    },
    {
      icon: GaugeIcon,
      label: "Absenteeism Rate",
      sublabel: "This Period",
      value: `${kpis.absenteeismRatePct || 0}%`,
      variant: absenteeismStatus.variant,
      status: { icon: absenteeismStatus.statusIcon, label: absenteeismStatus.statusLabel },
      to: attendanceTo,
      filter: { ...baseFilter, hrFlag: "Absent", ...periodFilter },
      metrics: [],
      title: "Absent-flagged records divided by all working-day records this period.",
    },
    {
      icon: AlarmIcon,
      label: "Overtime Hours",
      sublabel: "Total, This Period",
      value: `${kpis.overtimeHoursTotal || 0}h`,
      variant: overtimeStatus.variant,
      status: { icon: overtimeStatus.statusIcon, label: overtimeStatus.statusLabel },
      to: attendanceTo,
      filter: { ...baseFilter, overtimeOnly: "true", ...periodFilter },
      metrics: [
        { label: "Employees With Overtime", value: kpis.employeesWithOvertimeCount || 0 },
      ],
      title:
        "Sum of hours worked after 6:00 PM (18:00) across working-day records this period -- not hours above 8/day, and not affected by what time the employee arrived.",
    },
    {
      icon: CalendarXIcon,
      label: "Leave Days Taken",
      sublabel: "Total, This Period",
      value: kpis.leaveDaysCount || 0,
      variant: "blueCard",
      to: attendanceTo,
      filter: { ...baseFilter, onLeave: "true", ...periodFilter },
      metrics: [{ label: "Employees on Leave", value: kpis.employeesOnLeaveCount || 0 }],
      title:
        "Sum of day_fraction across all HR2000 leave-ledger entries falling in the selected period, company-wide (or within the selected department).",
    },
    {
      icon: UserCirclePlusIcon,
      label: "Onboarding",
      sublabel: "Open Cases",
      value: kpis.openOnboardingCount || 0,
      variant: "blueCard",
      to: onboardingTo,
      filter: {},
      metrics: [
        { label: "Completed This Period", value: kpis.onboardingCompletedInPeriod || 0 },
        {
          label: "Avg Days to Complete",
          value:
            kpis.avgOnboardingDaysToComplete != null
              ? `${kpis.avgOnboardingDaysToComplete}d`
              : "N/A",
        },
      ],
      title:
        "Employees currently mid-checklist for onboarding. Avg Days to Complete is measured across cases closed this period.",
    },
    {
      icon: UserMinusIcon,
      label: "Offboarding",
      sublabel: "Open Cases",
      value: kpis.openOffboardingCount || 0,
      variant: "blueCard",
      to: offboardingTo,
      filter: {},
      metrics: [
        { label: "Completed This Period", value: kpis.offboardingCompletedInPeriod || 0 },
        {
          label: "Avg Days to Complete",
          value:
            kpis.avgOffboardingDaysToComplete != null
              ? `${kpis.avgOffboardingDaysToComplete}d`
              : "N/A",
        },
      ],
      title:
        "Employees currently mid-checklist for offboarding. Avg Days to Complete is measured across cases closed this period.",
    },
  ];
}

// "Needs Attention" section -- confirmations/contracts/checklists/data
// hygiene that need HR or management follow-up. Same OR-of-cohorts tile
// pattern (and thresholds) as Employee Overview's own HR Actions Needed /
// Data Gaps tiles, extended with the Lifecycle stuck-case counts this
// company-wide Reports page adds on top.
export function getHrReportsNeedsAttentionConfig(
  kpis = {},
  canAccessHrOps = false,
  filters = {},
) {
  const baseFilter = {
    ...(filters.department && { department: filters.department }),
  };
  const employeesTo = canAccessHrOps ? "/app/hr/employees/list" : undefined;
  const onboardingTo = canAccessHrOps ? "/app/hr/onboarding" : undefined;
  const offboardingTo = canAccessHrOps ? "/app/hr/offboarding" : undefined;

  const hrActionsSeverity =
    kpis.lateConfirmationsCount > 0
      ? 2
      : kpis.confirmationsDueSoonCount > 0
        ? 1
        : 0;
  const hrActionsStatus = getStatusVariant(hrActionsSeverity, {
    direction: "low-good",
    thresholds: { warningAt: 1, criticalAt: 2 },
  });

  const stuckSeverity =
    (kpis.onboardingStuckCount || 0) + (kpis.offboardingStuckCount || 0) > 0
      ? 2
      : 0;
  const stuckStatus = getStatusVariant(stuckSeverity, {
    direction: "low-good",
    thresholds: { warningAt: 1, criticalAt: 2 },
  });

  const dataGapsStatus = getStatusVariant(kpis.dataGapsCount || 0, {
    direction: "low-good",
    tiers: 2,
    badLevel: "critical",
    thresholds: { criticalAt: 1 },
  });

  return [
    {
      icon: CalendarIcon,
      label: "HR Actions Needed",
      sublabel: "Confirmations Due or Overdue",
      value:
        (kpis.confirmationsDueSoonCount || 0) + (kpis.lateConfirmationsCount || 0),
      variant: hrActionsStatus.variant,
      status: { icon: hrActionsStatus.statusIcon, label: hrActionsStatus.statusLabel },
      to: null,
      metrics: [
        {
          label: "Confirmations Due Soon",
          value: kpis.confirmationsDueSoonCount || 0,
          to: employeesTo,
          filter: { ...baseFilter, employmentStatus: 3, confirmationStatus: "due_soon" },
        },
        {
          label: "Confirmations Overdue",
          value: kpis.lateConfirmationsCount || 0,
          to: employeesTo,
          filter: { ...baseFilter, employmentStatus: 3, confirmationStatus: "overdue" },
        },
      ],
      title:
        "Confirmation is due 6 months after join_date (company policy). Same formula as Employee Overview's own HR Actions Needed tile.",
    },
    {
      icon: ListChecksIcon,
      label: "Stuck Lifecycle Cases",
      sublabel: "Open More Than 14 Days",
      value: (kpis.onboardingStuckCount || 0) + (kpis.offboardingStuckCount || 0),
      variant: stuckStatus.variant,
      status: { icon: stuckStatus.statusIcon, label: stuckStatus.statusLabel },
      to: null,
      metrics: [
        { label: "Onboarding", value: kpis.onboardingStuckCount || 0, to: onboardingTo },
        { label: "Offboarding", value: kpis.offboardingStuckCount || 0, to: offboardingTo },
      ],
      title:
        "Onboarding/offboarding checklists still OPEN more than 14 days after being opened -- same 'stuck' definition the Lifecycle Case List itself uses.",
    },
    {
      icon: UserCircleDashedIcon,
      label: "Data Gaps",
      sublabel: "Missing Manager, Department, Profile, or Status Mismatch",
      value: kpis.dataGapsCount || 0,
      variant: dataGapsStatus.variant,
      status: { icon: dataGapsStatus.statusIcon, label: dataGapsStatus.statusLabel },
      to: null,
      metrics: [
        {
          label: "No Manager",
          value: kpis.noManagerCount || 0,
          to: employeesTo,
          filter: { ...baseFilter, statusBucket: "active", manager: "__null__" },
        },
        {
          label: "No Department",
          value: kpis.noDepartmentCount || 0,
          to: employeesTo,
          filter: { ...baseFilter, statusBucket: "active", department: "__null__" },
        },
        {
          label: "No Profile",
          value: kpis.noProfileCount || 0,
          to: employeesTo,
          filter: { ...baseFilter, statusBucket: "active", profile: "__null__" },
        },
        {
          label: "Status Mismatch",
          value: kpis.statusMismatchCount || 0,
          to: employeesTo,
          filter: {
            ...baseFilter,
            statusBucket: "active",
            confirmationStatus: "overdue",
            excludeEmploymentStatus: 3,
          },
        },
      ],
      title:
        "Active employees missing manager_id, department_id, or profile_id, plus employees moved off Probation without ever being confirmed. Same formula as Employee Overview's own Data Gaps tile.",
    },
  ];
}
