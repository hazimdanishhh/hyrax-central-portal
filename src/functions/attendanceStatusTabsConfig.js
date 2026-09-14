// functions/attendanceStatusTabsConfig.js
//
// Single source of truth for the HR-flag status-tab row shared by
// AttendanceManagement.jsx (HR), MyAttendance.jsx, and TeamAttendance.jsx --
// factored out so a future tab addition/change can't drift across 3
// independently hand-rolled copies. Each page calls
// buildStatusTabs({ searchParams, ...getAttendanceStatusTabsConfig() }).
//
// Every paramKey here must stay in sync with each page's own
// SEARCH_MODE_FILTER_KEYS array -- already true for all 3 pages today.
export function getAttendanceStatusTabsConfig() {
  return {
    statuses: [
      { label: "Pending Approval", value: "Pending App Approval" },
      { label: "Missing Check-Out", value: "Missing App Check-Out" },
      { label: "Incomplete Scans", value: "Incomplete Card Scans" },
    ],
    statusTypeMap: {
      "Pending App Approval": "yellow",
      "Missing App Check-Out": "red",
      "Incomplete Card Scans": "red",
    },
    paramKey: "hrFlag",
    extraTabs: [
      // hr_flag='Absent' alone also matches every ordinary unworked
      // weekend -- pairing it with dayType=working is what makes this tab
      // mean "genuinely missing on a day they were expected."
      {
        label: "Absent",
        type: "red",
        conditions: [
          { paramKey: "hrFlag", value: "Absent" },
          { paramKey: "dayType", value: "working" },
        ],
      },
      { label: "On Leave", paramKey: "onLeave", value: "true", type: "blue" },
      // Bare "Public Holiday" deliberately omitted -- a calendar fact, not
      // an attendance outcome. Worked on Holiday/Weekend are the
      // actionable versions (real attendance on an expected day off).
      { label: "Worked on Holiday", paramKey: "workedOnHoliday", value: "true", type: "yellow" },
      { label: "Worked on Weekend", paramKey: "workedOnWeekend", value: "true", type: "yellow" },
      { label: "Leave Conflict", paramKey: "leaveAttendanceConflict", value: "true", type: "red" },
      { label: "Insufficient Half-Day", paramKey: "insufficientHalfDayHours", value: "true", type: "red" },
      { label: "Leave Data Error", paramKey: "leaveFractionError", value: "true", type: "red" },
    ],
  };
}
