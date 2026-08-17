// Single source of truth for the 4-value task_status enum (req #7) --
// one field, not a separate is_cancelled boolean (cancelled is mutually
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
// status -- one primary forward transition plus Cancel. COMPLETED/CANCELLED
// are terminal here (no quick actions -- status can still be changed
// manually via the edit sidebar). Defined once so the button set can't
// drift between ProjectTasksTab and MyTasks, which both render TaskCard.
export const TASK_STATUS_ACTIONS = {
  TO_DO: [
    { label: "Start", nextStatus: "IN_PROGRESS", style: "approval" },
    { label: "Cancel", nextStatus: "CANCELLED", style: "rejection" },
  ],
  IN_PROGRESS: [
    { label: "Complete", nextStatus: "COMPLETED", style: "approval" },
    { label: "Cancel", nextStatus: "CANCELLED", style: "rejection" },
  ],
  COMPLETED: [],
  CANCELLED: [],
};
