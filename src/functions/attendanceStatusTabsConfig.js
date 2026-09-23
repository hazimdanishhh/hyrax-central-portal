// functions/attendanceStatusTabsConfig.js
//
// Single source of truth for the status-tab row shared by
// AttendanceManagement.jsx (HR), MyAttendance.jsx, and TeamAttendance.jsx --
// factored out so a future tab addition/change can't drift across 3
// independently hand-rolled copies. Each page calls
// buildStatusTabs({ searchParams, ...getAttendanceStatusTabsConfig() }).
//
// Every paramKey here must stay in sync with each page's own
// SEARCH_MODE_FILTER_KEYS array -- a key missing from that array leaves the
// page in Day mode, so the tab silently answers its question for ONE calendar
// day instead of the selected range.
//
// ---------------------------------------------------------------------------
// WHAT THE TABS ARE FOR, now that the filters cover the same ground
//
// These are shortcuts to the handful of questions worth one click, NOT a
// second copy of the dropdowns. Previously 10 of the 11 tabs duplicated a
// dropdown value exactly, which is why the row had grown to eleven items
// nobody could scan.
//
// The rule applied here: a tab earns its place only if it is something
// somebody checks ROUTINELY -- the reconciliation queue, and the two
// "somebody worked when they weren't expected to" cases that feed statutory
// pay. Everything else lives in the dropdowns, which can now express it far
// more precisely than a tab ever could (day state AND data quality AND
// approval state, composed).
//
// Tabs now key off day_state rather than hr_flag, which removes the
// paired-condition workaround the Absent tab needed: hr_flag='Absent' also
// matched every ordinary unworked weekend, so that tab had to carry
// `dayType=working` alongside it or it flooded HR with harmless Saturdays.
// day_state distinguishes `absent` from `weekend` natively, so the tab is a
// single condition again and cannot be got wrong by omitting the second half.
// ---------------------------------------------------------------------------
export function getAttendanceStatusTabsConfig() {
  return {
    // The day-state tabs -- the reconciliation queue, in the order HR works
    // through it. `statuses` drives the primary tab group; `paramKey` below
    // applies to all of them.
    statuses: [
      { label: "Absent", value: "absent" },
      { label: "Leave Conflict", value: "leave_conflict" },
      { label: "Insufficient Half-Day", value: "insufficient_half_day" },
      { label: "Leave Data Error", value: "leave_data_error" },
    ],
    statusTypeMap: {
      absent: "red",
      leave_conflict: "red",
      // Yellow, not red, matching this category's treatment everywhere else:
      // per its seeded acknowledgement reason ("Hours Reviewed and Accepted")
      // it is typically a benign administrative gap rather than a hard error.
      insufficient_half_day: "yellow",
      leave_data_error: "red",
    },
    paramKey: "dayState",

    extraTabs: [
      // The single most-used view: everything still outstanding this cycle,
      // across all five unresolved categories, acknowledgement-aware. This is
      // the tab HR should live in during a payroll run.
      {
        label: "Needs Reconciliation",
        paramKey: "needsReconciliation",
        value: "true",
        type: "red",
      },

      // Real attendance on a day nobody was expected to work. Kept as tabs
      // (rather than folded into the day-state group) because they are
      // payroll events -- each feeds a statutory wage tier -- and HR checks
      // them every cycle regardless of whether anything is wrong.
      //
      // These read the is_worked_on_* booleans rather than day_state, so a
      // Saturday that is ALSO a public holiday appears under BOTH, which is
      // correct: it earns both entitlements.
      { label: "Worked on Holiday", paramKey: "workedOnHoliday", value: "true", type: "yellow" },
      { label: "Worked on Weekend", paramKey: "workedOnWeekend", value: "true", type: "yellow" },

      // Data-quality shortcut. Deliberately ONE tab rather than the three
      // hr_flag used to offer ('Missing App Check-Out', 'Incomplete Card
      // Scans', and the approval states): under hr_flag a day could only ever
      // report one of these, and in practice reported none of them, because
      // the approval branches sat above both quality branches. The dropdown
      // now separates them properly for anyone who needs the distinction.
      {
        label: "Pending Approval",
        paramKey: "approvalState",
        value: "pending",
        type: "yellow",
      },
    ],
  };
}
