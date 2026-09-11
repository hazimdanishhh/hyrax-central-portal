import {
  GaugeIcon,
  WarningIcon,
  ClockIcon,
  CalendarXIcon,
  UsersIcon,
} from "@phosphor-icons/react";
import { getStatusVariant } from "../../../../../../functions/statusVariant";

/**
 * "Project Snapshot" section's KPI tiles for the per-project Overview
 * tab. NOT subject to the 4-tile cap the two list pages' overviews carry
 * (that constraint is specifically about Projects/My Tasks) -- this is a
 * genuine Overview/dashboard page, not a list page, so it's free to carry
 * more tiles and richer sub-metrics without needing to look like a 2-up
 * grid on small screens (no `overviewCard2` modifier passed anywhere this
 * renders) -- it just wraps naturally in OverviewCards' own responsive
 * grid, same as every other dashboard's Overview page (EmployeeOverview.jsx/
 * AttendanceOverview.jsx don't pass a style override either).
 *
 * Overdue/Due Soon/Completed Late all route through getStatusVariant, same
 * shape as the list pages' own tiles. Progress % and the Team & Resources
 * tile are informational (no computable "worse" direction) -- static
 * blue, per docs/DASHBOARD-CONVENTIONS.md §4's own category.
 */
export function getProjectOverviewConfig(kpis, projectId) {
  const overdue = getStatusVariant(kpis.overdueCount, {
    direction: "low-good",
    tiers: 2,
    badLevel: "critical",
    thresholds: { criticalAt: 1 },
  });
  const dueSoon = getStatusVariant(kpis.dueSoonCount, {
    direction: "low-good",
    tiers: 2,
    badLevel: "warning",
    thresholds: { criticalAt: 1 },
  });
  // Retrospective quality-of-delivery signal, not an active fire (the task
  // is already done) -- capped at warning, never critical, same reasoning
  // as Due Soon's own cap.
  const completedLate = getStatusVariant(kpis.completedLateCount, {
    direction: "low-good",
    tiers: 2,
    badLevel: "warning",
    thresholds: { criticalAt: 1 },
  });

  const tasksTo = `/app/workspace/projects/${projectId}/tasks`;
  const membersTo = `/app/workspace/projects/${projectId}/members`;
  const documentsTo = `/app/workspace/projects/${projectId}/documents`;

  return [
    {
      label: "Progress",
      value: kpis.progressPercentage != null ? `${kpis.progressPercentage}%` : "—",
      subvalue: `(${kpis.completedCount} of ${kpis.totalTaskCount} tasks)`,
      icon: GaugeIcon,
      variant: "blueCardFill",
      filter: null,
      to: tasksTo,
    },
    {
      label: "Overdue",
      value: kpis.overdueCount,
      icon: WarningIcon,
      variant: overdue.variant,
      status: overdue.statusLabel ? { icon: overdue.statusIcon, label: overdue.statusLabel } : null,
      filter: { dueStatus: "overdue" },
      to: tasksTo,
    },
    {
      label: "Due Soon",
      value: kpis.dueSoonCount,
      icon: ClockIcon,
      variant: dueSoon.variant,
      status: dueSoon.statusLabel ? { icon: dueSoon.statusIcon, label: dueSoon.statusLabel } : null,
      filter: { dueStatus: "due_soon" },
      to: tasksTo,
    },
    {
      label: "Completed Late",
      sublabel: "Finished after their due date",
      value: kpis.completedLateCount,
      icon: CalendarXIcon,
      variant: completedLate.variant,
      status: completedLate.statusLabel
        ? { icon: completedLate.statusIcon, label: completedLate.statusLabel }
        : null,
      filter: { dueStatus: "completed_late" },
      to: tasksTo,
    },
    {
      label: "Team & Resources",
      value: kpis.memberCount,
      icon: UsersIcon,
      variant: "blueCard",
      filter: null,
      to: membersTo,
      metrics: [
        { label: "Working members", value: kpis.workingMemberCount, to: membersTo },
        { label: "CC", value: kpis.ccMemberCount, to: membersTo },
        { label: "Documents", value: kpis.documentCount, to: documentsTo },
      ],
    },
  ];
}
