import {
  DAY_STATE_OPTIONS,
  EVIDENCE_QUALITY_OPTIONS,
  APPROVAL_STATE_OPTIONS,
  DAY_CALENDAR_TYPE_OPTIONS,
} from "@/functions/attendanceDayState";

// Trimmed version of HR's getAttendanceActivitiesFilterConfig -- no
// employee/department/manager pickers, since this page's scope is always
// "me". Status + the business-window toggles are still useful self-service
// slices ("show me my late arrivals", "my overtime days").
export function getMyAttendanceFilterConfig() {
  return [
    // The four axes -- see HR's filter config for why these replace the
    // single hr_flag "Status" dropdown. Kept identical across all three lists
    // deliberately: an employee, their manager and HR looking at the same day
    // should have the same words available for it.
    {
      key: "dayState",
      label: "Day Type",
      options: DAY_STATE_OPTIONS,
    },
    {
      key: "evidenceQuality",
      label: "Data Quality",
      options: EVIDENCE_QUALITY_OPTIONS.map(({ value, label }) => ({ value, label })),
    },
    {
      key: "approvalState",
      label: "Approval",
      options: APPROVAL_STATE_OPTIONS.map(({ value, label }) => ({ value, label })),
    },
    {
      key: "calendarType",
      label: "Calendar",
      options: DAY_CALENDAR_TYPE_OPTIONS,
    },
    {
      // See the HR filter config's own comment on this same key -- excludes
      // hr_flag = "Absent" and an unworked Public Holiday, not is_weekend
      // (a worked Saturday still correctly counts as present).
      key: "presentOnly",
      label: "Presence",
      options: [
        { label: "Present Only (Exclude Absent/Holiday)", value: "true" },
      ],
    },
    {
      key: "onLeave",
      label: "Leave",
      options: [{ label: "On Leave Only", value: "true" }],
    },
    {
      key: "overtimeOnly",
      label: "Overtime",
      options: [{ label: "Overtime Only (Beyond 8h/Day)", value: "true" }],
    },
    {
      key: "lateArrival",
      label: "Late Arrival",
      options: [{ label: "First In After 9:00 AM", value: "true" }],
    },
    {
      key: "earlyLeave",
      label: "Early Leave",
      options: [{ label: "Last Out Before 5:00 PM", value: "true" }],
    },
    {
      key: "leaveAttendanceConflict",
      label: "Leave Conflict",
      options: [{ label: "Full-Day Leave But Attended", value: "true" }],
    },
    {
      // Two readings -- see HR's own filterConfig.js and
      // applyAttendanceFilter's matching case for why this one category is
      // split and its two neighbours aren't.
      key: "insufficientHalfDayHours",
      label: "Insufficient Half-Day Hours",
      options: [
        { label: "Half-Day Leave, <4h Worked", value: "true" },
        { label: "Half-Day Leave, <4h Worked - Unresolved", value: "unresolved" },
      ],
    },
    {
      key: "leaveFractionError",
      label: "Leave Data Error",
      options: [{ label: "Leave Fraction Sum > 1 Day", value: "true" }],
    },
    {
      key: "publicHoliday",
      label: "Public Holiday",
      options: [{ label: "Public Holiday Only", value: "true" }],
    },
    {
      key: "workedOnHoliday",
      label: "Worked on Holiday",
      options: [{ label: "Worked on Holiday Only", value: "true" }],
    },
    {
      key: "workedOnWeekend",
      label: "Worked on Weekend",
      options: [{ label: "Worked on Weekend Only", value: "true" }],
    },
    {
      // See the HR filter config's own comment on this same key -- a real
      // server-side filter against needs_reconciliation, acknowledgement-aware.
      key: "needsReconciliation",
      label: "Reconciliation",
      options: [{ label: "Needs Reconciliation", value: "true" }],
    },
  ];
}
