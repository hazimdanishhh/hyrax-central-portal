// Single source of truth for the 5-value project_status enum (req #8) --
// imported everywhere a project status is displayed or edited, so the set
// never drifts across files.
export const PROJECT_STATUSES = [
  { label: "Planning", value: "PLANNING" },
  { label: "Active", value: "ACTIVE" },
  { label: "On Hold", value: "ON_HOLD" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Cancelled", value: "CANCELLED" },
];

// Maps onto StatusBox's existing 5-color vocabulary (red/green/yellow/grey/blue).
export const PROJECT_STATUS_TYPE = {
  PLANNING: "grey",
  ACTIVE: "blue",
  ON_HOLD: "yellow",
  COMPLETED: "green",
  CANCELLED: "red",
};
