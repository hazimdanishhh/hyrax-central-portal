// COLORS FOR MULTIPLE USE CHARTS
export const CHART_PALETTE = [
  "#63d795",
  "#63a7d7",
  "#d7b663",
  "#d76363",
  "#d79b63",
  "#6763d7",
  "#a163d7",
  "#ac41c7",
  "#e178b2",
];

// SEMANTIC COLOR SYSTEM
export const STATUS_COLORS = {
  Active: "#4bc793",
  Inactive: "#ffb74d",
  Retired: "#d76363",
};

export const CONDITION_COLORS = {
  New: "#4bc793",
  Good: "#1abee4",
  Poor: "#ffb74d",
  Damaged: "#d76363",
};

export const RISK_COLORS = {
  Safe: "#4bc793",
  Risk: "#d76363",
};

export const UTILIZATION_COLORS = {
  Assigned: "#4bc793",
  Unassigned: "#ffb74d",
};

export const GREEN_COLOR = "#4bc793";

export const YELLOW_COLOR = "#ffb74d";

export const RED_COLOR = "#d76363";

export const BLUE_COLOR = "#1abee4";

export const PURPLE_COLOR = "#6763d7";

// EMPLOYMENT TYPES

export const EMPLOYMENT_TYPE_COLORS = {
  "Full-Time": "#4bc793",
  "Part-Time": "#1abee4",
  Contractor: "#ffb74d",
  Intern: "#6763d7",
  Freelancer: "#ac41c7",
  Temporary: "#d76363",
  Unspecified: "#9CA3AF",
};

export const GENDER_COLORS = {
  Male: "#3B82F6", // blue
  Female: "#EC4899", // pink
  "Not Specified": "#9CA3AF", // gray
};

// SALES LEAD STAGES

export const LEAD_STAGE_COLORS = {
  DISCOVERY: "#1abee4", // blue
  SAMPLE_TEST: "#6763d7", // indigo
  PROPOSAL: "#ffb74d", // yellow/orange
  NEGOTIATION: "#ac41c7", // purple
  WON: "#4bc793", // green
  LOST: "#d76363", // red
};

// SALES LEAD STATUS

export const LEAD_STATUS_COLORS = {
  Active: "#1abee4", // blue
  Won: "#4bc793", // green
  Lost: "#d76363", // red
  Hold: "#ffb74d", // yellow
  Cancelled: "#9CA3AF", // gray
};

export const LEAD_UTILIZATION_COLORS = {
  Open: "#1abee4", // blue
  Won: "#4bc793", // green
  Lost: "#d76363", // red
  Hold: "#ffb74d", // yellow
};

export const LEAD_TREND_COLORS = {
  Total: "#1abee4",
  Won: "#4bc793",
  Lost: "#d76363",
  Active: "#6763d7",
  Hold: "#ffb74d",
};

export const PRODUCT_TYPE_COLORS = {
  "TRANSFORMER OILS": "#6763d7",
  LUBRICANTS: "#4bc793",
  MIXED: "#ffb74d",
};

// ATTENDANCE HR_FLAG (unified_daily_attendance) -- same green/yellow/red
// convention StatusBox already uses for this field elsewhere (AttendanceCard).
//
// DEPRECATED as of the day-model rework. hr_flag is a compatibility column
// scheduled for removal; use ATTENDANCE_DAY_STATE_COLORS below instead, which
// is keyed on day_state and does not conflate calendar type, approval state
// and data quality into one scale. Retained only until every chart has moved.
export const ATTENDANCE_FLAG_COLORS = {
  OK: "#4bc793",
  Approved: "#4bc793",
  "Pending App Approval": "#ffb74d",
  "Missing App Check-Out": "#d76363",
  "Incomplete Card Scans": "#dd8b48",
  Absent: "#d76363",
  // HR2000 leave ledger integration -- get_attendance_dashboard_rpc.sql's
  // hrFlagBreakdownData buckets every dynamic "On Leave (AL)"/"On Leave
  // (AL+MC)" value into this one flat "On Leave" category before grouping,
  // so it always resolves here instead of falling back to PieChartRenderer's
  // unmapped grey. Matches AttendanceType.jsx/StatusBox's own purple.
  "On Leave": PURPLE_COLOR,
  "Public Holiday": BLUE_COLOR,
};

// ATTENDANCE DAY STATE (unified_daily_attendance.day_state) -- the replacement
// for ATTENDANCE_FLAG_COLORS above, keyed on the derived label rather than on
// hr_flag's conflated string.
//
// Keys are the LABELS from attendanceDayState.js, not the raw snake_case
// values, because the chart renderers group by display label. Keep the two in
// step: a key here that does not match a label there falls through to
// PieChartRenderer's unmapped grey, silently.
//
// Colour choices follow each state's `type` in attendanceDayState.js, so a
// segment in a chart and a StatusBox badge for the same day agree.
export const ATTENDANCE_DAY_STATE_COLORS = {
  // Ordinary
  Worked: GREEN_COLOR,
  Absent: RED_COLOR,
  "On Leave": PURPLE_COLOR,
  "On Leave (Partial)": PURPLE_COLOR,

  // Needs reconciliation. Insufficient half-day is yellow, not red, per its
  // seeded acknowledgement reason ("Hours Reviewed and Accepted") -- typically
  // a benign administrative gap rather than a hard error, so it should not
  // read as equally urgent as a genuine data-integrity fault.
  "Leave/Attendance Conflict": RED_COLOR,
  "Insufficient Half-Day Hours": YELLOW_COLOR,
  "Leave Data Error": RED_COLOR,

  // Calendar. Grey for a day nobody was expected to work; blue once it was
  // actually worked, because that is a payroll event (statutory wage tier),
  // not merely a calendar fact.
  Weekend: "#9CA3AF",
  "Weekend (Worked)": BLUE_COLOR,
  "Weekend (On Leave)": "#9CA3AF",
  "Public Holiday": BLUE_COLOR,
  "Public Holiday (Worked)": BLUE_COLOR,
  "Public Holiday (On Leave)": BLUE_COLOR,
  "Weekend + Public Holiday": BLUE_COLOR,
  "Weekend + Public Holiday (Worked)": BLUE_COLOR,
};

// ATTENDANCE DATA QUALITY (unified_daily_attendance.evidence_quality) -- a
// separate axis from day_state, so it gets its own scale rather than competing
// for the same chart. Under hr_flag these two were the same string and only
// one could ever be shown.
export const ATTENDANCE_EVIDENCE_QUALITY_COLORS = {
  Complete: GREEN_COLOR,
  "Incomplete Card Scans": "#dd8b48",
  "Missing App Check-Out": RED_COLOR,
  "Incomplete Scans + Missing Check-Out": RED_COLOR,
  "No Evidence": "#9CA3AF",
};

// ATTENDANCE APPROVAL (unified_daily_attendance.approval_state)
export const ATTENDANCE_APPROVAL_STATE_COLORS = {
  Approved: GREEN_COLOR,
  "Pending Approval": YELLOW_COLOR,
  Rejected: RED_COLOR,
  "No App Activity": "#9CA3AF",
};

// WORKSPACE TASK STATUS (per-project Overview tab's "Task Breakdown" donut)
export const TASK_STATUS_COLORS = {
  "To Do": BLUE_COLOR,
  "In Progress": YELLOW_COLOR,
  Completed: GREEN_COLOR,
  Cancelled: "#9CA3AF",
};

// ATTENDANCE WORK CHANNEL MIX (unified_daily_attendance's hw_check_in vs
// app_check_in presence) -- doc-02's "WFH vs office split" KPI, in Hyrax's
// actual terms (hardware badge scan vs self-service app clock-in).
export const WORK_CHANNEL_COLORS = {
  Office: "#1abee4",
  Remote: "#6763d7",
  Both: "#4bc793",
  Unclassified: "#9CA3AF",
};
