// Single source of truth for the 4-value lifecycle_item_status enum --
// mirrors taskStatusMeta.js's TASK_STATUS_ACTIONS shape exactly. SKIPPED
// items never get an action (system-seeded "not applicable", or a rare
// human skip already made) -- there's no forward transition out of it.
import { CheckIcon, ArrowCounterClockwiseIcon } from "@phosphor-icons/react";

export const ITEM_STATUSES = [
  { label: "Pending", value: "PENDING" },
  { label: "In Progress", value: "IN_PROGRESS" },
  { label: "Done", value: "DONE" },
  { label: "Skipped", value: "SKIPPED" },
];

export const ITEM_STATUS_TYPE = {
  PENDING: "grey",
  IN_PROGRESS: "blue",
  DONE: "green",
  SKIPPED: "grey",
};

// Keyed by the item's CURRENT status -- a checklist item can only ever be
// manually advanced through these buttons (Mark Done from either PENDING
// or IN_PROGRESS, Undo back to PENDING). Derived items
// (onboardingChecklistMeta.js/offboardingChecklistMeta.js's class:
// "DERIVED") never show these -- ChecklistItemCard gates on class, not
// just ownership, before rendering any action for them.
export const ITEM_STATUS_ACTIONS = {
  PENDING: [
    { label: "Mark Done", nextStatus: "DONE", style: "approval", icon: CheckIcon },
  ],
  IN_PROGRESS: [
    { label: "Mark Done", nextStatus: "DONE", style: "approval", icon: CheckIcon },
  ],
  DONE: [
    { label: "Undo", nextStatus: "PENDING", style: "yellow", icon: ArrowCounterClockwiseIcon },
  ],
  SKIPPED: [],
};
