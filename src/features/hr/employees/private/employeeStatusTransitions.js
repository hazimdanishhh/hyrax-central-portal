import {
  ClockIcon,
  WarningIcon,
  CheckCircleIcon,
  UserCheckIcon,
} from "@phosphor-icons/react";

// Guided employment-status transitions for Employee Management -- mirrors
// Sales Leads' stage-change UX (LeadSidebar.jsx / leadStageTransitions.js /
// actionConfig.js: guided button -> ActionModal collecting the specific
// facts that transition needs -> one generic update call), but combines
// label + icon + style + target status into ONE object per transition
// (taskStatusMeta.js's cleaner single-source-of-truth shape), avoiding
// leadStageTransitions.js's fragile string-matching-for-icon pattern.
//
// Scoped to offboarding-related transitions plus Probation Confirmation --
// not an exhaustive graph for every employment_status value. Suspend/
// Reinstate and Start/Return-from-Leave guided actions are still
// deliberately out of scope (added 2026-09-02: Confirm was pulled in from
// that same originally-out-of-scope list because it already has real
// supporting infrastructure -- employees.confirmation_date,
// check_employee_confirmation_status_mismatches.sql -- the other three
// don't yet and need their own design pass, not a copy-paste of this
// shape). See docs/EMPLOYEE-LIFECYCLE-CHECKLIST-ARCHITECTURE.md Part 2.
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
  // Deliberately does NOT hardcode a target status (unlike the old
  // IMMEDIATE_TERMINATION it replaces) -- an employee leaving with no
  // notice period can just as easily be a resignation or a retirement as a
  // termination. Structurally symmetric with BEGIN_OFFBOARDING ->
  // FINALIZE_DEPARTURE: both paths defer the final classification to the
  // same Final Status picker (FINALIZE_DEPARTURE_STATUS_IDS), this one just
  // collects it immediately instead of after a waiting period. See
  // docs/EMPLOYEE-LIFECYCLE-CHECKLIST-ARCHITECTURE.md's UAT readiness pass.
  IMMEDIATE_DEPARTURE: {
    key: "IMMEDIATE_DEPARTURE",
    label: "Immediate Departure (No Notice)",
    icon: WarningIcon,
    style: "rejection",
    targetEmploymentStatusId: null, // asked in the modal -- Terminated/Resigned/Retired
    modalTitle: "Immediate Departure",
    modalDescription:
      "Use when there is no notice period -- the employee is leaving effective immediately, whether by resignation, termination, or retirement. Starts the offboarding checklist with no advance lead time.",
    collectsExpectedLastDay: true,
    collectsTerminationReason: true,
    collectsFinalStatus: true,
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
  // Fills the "Probation Confirmation" gap named in this file's own header.
  // Requires a confirmation date in the same modal, not a separate raw
  // edit afterward -- check_employee_confirmation_status_mismatches.sql
  // already flags exactly the failure mode of moving someone off Probation
  // while confirmation_date stays null past its due date, so the mutation
  // (employeeStatusTransitionMutations.js) writes employment_status_id and
  // confirmation_date in the SAME update, never one without the other.
  CONFIRM_PROBATION: {
    key: "CONFIRM_PROBATION",
    label: "Confirm",
    icon: UserCheckIcon,
    style: "approval",
    targetEmploymentStatusId: 1, // Active
    modalTitle: "Confirm Probation",
    modalDescription:
      "Confirms this employee has passed probation and moves them to Active. Requires their confirmation date.",
    collectsConfirmationDate: true,
  },
};

// The 3 terminal statuses Finalize Departure can resolve to -- Terminated
// Notice (13) itself is excluded, since finalizing means LEAVING that
// status, not staying in it.
export const FINALIZE_DEPARTURE_STATUS_IDS = [4, 5, 6]; // Terminated, Resigned, Retired
