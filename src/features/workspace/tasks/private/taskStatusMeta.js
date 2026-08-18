// Single source of truth for the 4-value task_status enum (req #7) --
// one field, not a separate is_cancelled boolean (cancelled is mutually

import {
  CheckIcon,
  PlayIcon,
  XIcon,
  ArrowCounterClockwiseIcon,
} from "@phosphor-icons/react";

// exclusive with the other three).
export const TASK_STATUSES = [
  { label: "To Do", value: "TO_DO" },
  { label: "In Progress", value: "IN_PROGRESS" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Cancelled", value: "CANCELLED" },
];

export const TASK_STATUS_TYPE = {
  TO_DO: "grey",
  IN_PROGRESS: "blue",
  COMPLETED: "green",
  CANCELLED: "red",
};

// Quick-action buttons offered on a TaskCard, keyed by the task's CURRENT
// status -- one primary forward transition plus Cancel. Status can ONLY
// change through these buttons now -- the free-form status dropdown was
// removed from both task edit forms (see myTasksTableConfig/taskTableConfig's
// `computed: true` on the status column), so CANCELLED is genuinely
// terminal (no quick-action back out of it, and no dropdown escape hatch
// either). Defined once so the button set can't drift between
// ProjectTasksTab and MyTasks, which both render TaskCard.
export const TASK_STATUS_ACTIONS = {
  TO_DO: [
    {
      label: "Start",
      nextStatus: "IN_PROGRESS",
      style: "blue",
      icon: PlayIcon,
    },
    {
      label: "Cancel",
      nextStatus: "CANCELLED",
      style: "rejection",
      icon: XIcon,
    },
  ],
  IN_PROGRESS: [
    {
      label: "Complete",
      nextStatus: "COMPLETED",
      style: "approval",
      icon: CheckIcon,
    },
    {
      label: "Cancel",
      nextStatus: "CANCELLED",
      style: "rejection",
      icon: XIcon,
    },
  ],
  // Revert undoes an accidental Complete -- back to IN_PROGRESS, not
  // TO_DO, since the task genuinely did start (start_date is preserved;
  // only completed_date is cleared, by auto_set_task_lifecycle_dates()).
  COMPLETED: [
    {
      label: "Revert",
      nextStatus: "IN_PROGRESS",
      style: "yellow",
      icon: ArrowCounterClockwiseIcon,
    },
  ],
  CANCELLED: [],
};
