export { getAttendanceOverviewConfig as getMyAttendanceOverviewConfig } from "@/pages/user/hr/attendanceManagement/overview/overviewConfig";

// Reuses HR's tile config unchanged -- every tile is meaningful scoped to a
// single employee via p_employee_id. Used to also drop a since-removed
// "Active Headcount" sub-metric (always exactly 1 when scoped to self, not
// useful framing for "my own" attendance) -- the 2026-09-25 Attendance Rate
// redesign dropped that sub-metric from HR's config entirely, so there's
// nothing left here to filter out.
