import { ClockIcon, XCircleIcon, CheckCircleIcon } from "@phosphor-icons/react";

// Guided employment-status transitions for Employee Management -- mirrors
// Sales Leads' stage-change UX (LeadSidebar.jsx / leadStageTransitions.js /
// actionConfig.js: guided button -> ActionModal collecting the specific
// facts that transition needs -> one generic update call), but combines
// label + icon + style + target status into ONE object per transition
// (taskStatusMeta.js's cleaner single-source-of-truth shape), avoiding
// leadStageTransitions.js's fragile string-matching-for-icon pattern.
//
// Scoped to exactly what this pass was about -- offboarding-related
// transitions -- not an exhaustive graph for every employment_status value.
// Suspend/Reinstate, Start/Return-from-Leave, and Probation Confirmation
// guided actions are deliberately out of scope here; adding them would be
// scope creep against this module's own fixed-checklist, don't-over-build
// discipline. See docs/EMPLOYEE-LIFECYCLE-CHECKLIST-ARCHITECTURE.md Part 2.
//
// Deliberately does NOT write into employees.end_date -- reserved for
// non-full-time/contract employment with a pre-known scheduled end (see
// check_employee_contract_actions_due.sql). The "expected last day" these
// transitions collect goes onto employee_lifecycle_cases.expected_last_day
// instead (see employeeStatusTransitionMutations.js), not any employees
// column.
export const EMPLOYEE_STATUS_TRANSITIONS = {
  BEGIN_OFFBOARDING: {
    key: "BEGIN_OFFBOARDING",
    label: "Begin Offboarding (Notice)",
    icon: ClockIcon,
    style: "yellow",
    targetEmploymentStatusId: 13, // Terminated Notice
    modalTitle: "Begin Offboarding",
    modalDescription:
      "Starts this employee's offboarding checklist and notifies HR/IT, with lead time before their last day.",
    collectsExpectedLastDay: true,
    collectsTerminationReason: true,
  },
  IMMEDIATE_TERMINATION: {
    key: "IMMEDIATE_TERMINATION",
    label: "Immediate Termination",
    icon: XCircleIcon,
    style: "rejection",
    targetEmploymentStatusId: 4, // Terminated
    modalTitle: "Immediate Termination",
    modalDescription:
      "Use for a termination with no notice period. Also starts the offboarding checklist, with no advance lead time.",
    collectsExpectedLastDay: true,
    collectsTerminationReason: true,
  },
  FINALIZE_DEPARTURE: {
    key: "FINALIZE_DEPARTURE",
    label: "Finalize Departure",
    icon: CheckCircleIcon,
    style: "approval",
    targetEmploymentStatusId: null, // asked in the modal -- Terminated/Resigned/Retired
    modalTitle: "Finalize Departure",
    modalDescription:
      "Confirm the employee's final employment status now that their notice period has ended.",
    collectsExpectedLastDay: false,
    collectsTerminationReason: false,
    collectsFinalStatus: true,
  },
};

// The 3 terminal statuses Finalize Departure can resolve to -- Terminated
// Notice (13) itself is excluded, since finalizing means LEAVING that
// status, not staying in it.
export const FINALIZE_DEPARTURE_STATUS_IDS = [4, 5, 6]; // Terminated, Resigned, Retired
