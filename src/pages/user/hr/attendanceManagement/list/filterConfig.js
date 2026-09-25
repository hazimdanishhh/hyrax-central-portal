import {
  DAY_STATE_OPTIONS,
  EVIDENCE_QUALITY_OPTIONS,
  APPROVAL_STATE_OPTIONS,
  DAY_CALENDAR_TYPE_OPTIONS,
  EVIDENCE_SOURCE_OPTIONS,
} from "@/functions/attendanceDayState";

// Filters actually verified against unified_daily_attendance's real columns
// (hr_unified_daily_attendance_view.sql) and against fetchUnifiedAttendance's
// filter switch (attendanceOverviewService.js). The previous version of this
// config (employee/department/attendanceType/approvedBy/approvalStatus) was
// modeled on the old per-activity attendance_activities table this page used
// to query -- attendanceType/approvalStatus filtered columns that don't
// exist on this view (a 400 the moment they were used), and approvedBy had
// no matching case in the filter switch at all (a silent no-op).
export function getAttendanceActivitiesFilterConfig({
  employees,
  departments,
  workLocations,
}) {
  return [
    {
      key: "employee",
      label: "Employee",
      options: employees.map((e) => ({ label: e.full_name, value: e.id })),
    },
    {
      key: "department",
      label: "Department",
      options: departments.map((e) => ({ label: e.name, value: e.id })),
    },
    {
      key: "workLocation",
      label: "Work Location",
      options: (workLocations || []).map((w) => ({
        label: w.name,
        value: w.id,
      })),
    },
    {
      key: "manager",
      label: "Manager",
      options: employees.map((e) => ({ label: e.full_name, value: e.id })),
    },
    // -----------------------------------------------------------------
    // THE FOUR AXES. These replace the single "Status" dropdown, which was
    // hr_flag -- one string that had to answer all four of these questions
    // by picking a single winner, so asking about one meant losing the rest.
    // A day can now be filtered as "worked, but only one card scan, and
    // still pending approval" because each is its own column.
    //
    // Every option list comes from functions/attendanceDayState.js, which is
    // verified against the view's own CASE expressions. Do not hand-write
    // values here: one that is not a real column value returns zero rows
    // with no error anywhere, which reads exactly like "nothing to do".
    // -----------------------------------------------------------------
    {
      key: "dayState",
      label: "Day Type",
      options: DAY_STATE_OPTIONS,
    },
    {
      key: "evidenceQuality",
      label: "Data Quality",
      // Answers "show me everything with a record problem, regardless of
      // where it came from" -- impossible under hr_flag, whose
      // 'Missing App Check-Out' and 'Incomplete Card Scans' branches both sat
      // below the approval branches and so almost never fired.
      options: EVIDENCE_QUALITY_OPTIONS.map(({ value, label }) => ({ value, label })),
    },
    {
      key: "approvalState",
      label: "Approval",
      options: APPROVAL_STATE_OPTIONS.map(({ value, label }) => ({ value, label })),
    },
    {
      // Backend case already existed (applyAttendanceFilter's
      // "evidenceSource" case) but was never a selectable option here --
      // added 2026-09-25 so the Work Channel Mix chart's per-slice
      // drill-through (Attendance Overview restructuring pass) points at a
      // real, currently-selectable filter rather than a hidden backdoor.
      key: "evidenceSource",
      label: "Work Channel",
      options: EVIDENCE_SOURCE_OPTIONS.map(({ value, label }) => ({ value, label })),
    },
    {
      key: "calendarType",
      label: "Calendar",
      // Supersedes the old two-valued dayType (working/weekend), which was a
      // toggle over is_weekend and could not express "public holiday" at all
      // -- nor the weekend-that-is-also-a-holiday case, which contributes to
      // both statutory wage tiers.
      options: DAY_CALENDAR_TYPE_OPTIONS,
    },
    {
      // "Present" excludes hr_flag = "Absent" and an unworked Public
      // Holiday -- NOT is_weekend, since an unworked weekend already reads
      // hr_flag = "Absent" (hr_flag no longer has a "Weekend / Rest Day"
      // value at all), so it's already covered by the Absent exclusion
      // alone. A worked Saturday still correctly counts as present.
      key: "presentOnly",
      label: "Presence",
      options: [{ label: "Present Only (Exclude Absent/Holiday)", value: "true" }],
    },
    {
      // hrFlag's fixed enum can't target "On Leave (AL)"/"On Leave (AL+MC)"
      // -- the real value carries a dynamic leave-type suffix. A boolean
      // toggle against is_on_leave (same pattern as presentOnly/overtimeOnly)
      // works regardless of which type(s) fired that day.
      key: "onLeave",
      label: "Leave",
      options: [{ label: "On Leave Only", value: "true" }],
    },
    {
      key: "overtimeOnly",
      label: "Overtime",
      options: [{ label: "Overtime Only (Beyond 8h/Day)", value: "true" }],
    },
    // Both option labels were "First In After 9:00 AM" / "Last Out Before
    // 5:00 PM" until 2026-09-23. Neither was true any more, and stating a
    // threshold the filter does not apply is worse than stating none:
    //   * Neither fires on a day worked IN FULL (true_hours_worked >= 8), so
    //     "after 9:00 AM" promised rows the filter deliberately omits.
    //   * The early-leave cutoff is per work location (KL 17:00, Meru 17:30),
    //     so "5:00 PM" was only ever right for one site.
    //   * Early leave also skips single-scan days, where the arrival scan was
    //     previously being read as a departure.
    // The columns (is_late_arrival / is_early_leave) carry the full rule; see
    // hr_unified_daily_attendance_view.sql. The label now just names the fact.
    {
      key: "lateArrival",
      label: "Late Arrival",
      options: [{ label: "Late Arrival", value: "true" }],
    },
    {
      key: "earlyLeave",
      label: "Early Leave",
      options: [{ label: "Early Leave", value: "true" }],
    },
    {
      // HR2000 leave/attendance conflict detection -- see
      // hr_unified_daily_attendance_view.sql's is_leave_attendance_conflict.
      key: "leaveAttendanceConflict",
      label: "Leave Conflict",
      options: [{ label: "Full-Day Leave But Attended", value: "true" }],
    },
    {
      // Unlike its two neighbours this category is acknowledgeable, so it
      // offers both readings -- all such days (a payroll input regardless of
      // review status) and just the ones still outstanding. See
      // applyAttendanceFilter's matching case.
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
      // Public holidays integration -- hr_flag now carries a dynamic
      // "Public Holiday (<name>)" suffix (same reason onLeave above is a
      // boolean toggle, not a fixed hrFlag enum value): is_public_holiday
      // is the exact-match-safe column to filter on instead.
      key: "publicHoliday",
      label: "Public Holiday",
      options: [{ label: "Public Holiday Only", value: "true" }],
    },
    {
      // The reconciliation pull-list: every day an employee actually
      // attended on a day nobody was expected to work. Distinct from
      // publicHoliday above, which includes holidays nobody worked at all.
      key: "workedOnHoliday",
      label: "Worked on Holiday",
      options: [{ label: "Worked on Holiday Only", value: "true" }],
    },
    {
      // Mirrors workedOnHoliday above exactly -- the same reconciliation
      // pull-list, for weekends instead of public holidays.
      key: "workedOnWeekend",
      label: "Worked on Weekend",
      options: [{ label: "Worked on Weekend Only", value: "true" }],
    },
    {
      // Real server-side filter against unified_daily_attendance's own
      // acknowledgement-aware needs_reconciliation column -- mirrors Payroll
      // Export's own "Needs Reconciliation" filter idea, but per-day rather
      // than per-period, and forwarded to the query instead of post-filtered
      // client-side (see applyAttendanceFilter's "needsReconciliation" case).
      key: "needsReconciliation",
      label: "Reconciliation",
      options: [{ label: "Needs Reconciliation", value: "true" }],
    },
  ];
}
