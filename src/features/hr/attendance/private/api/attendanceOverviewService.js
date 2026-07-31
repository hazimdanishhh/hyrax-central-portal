// features/hr/attendance/private/api/attendanceOverviewService.js

import { supabase } from "../../../../../lib/supabaseClient";
import { formatDate, formatDateTime, formatTime } from "@/functions/formatDate";

/**
 * Unified Daily Attendance View -- one calendar day's roster in one shot.
 * Source: unified_daily_attendance
 *
 * Deliberately NOT row-paginated: the view is one row per active employee
 * per day, so a single day is already naturally bounded by active headcount
 * (see employment_status_category_migration.sql -- the view's own
 * expected_shifts CTE now filters to active-bucket employees). The previous
 * version of this function used OFFSET/LIMIT page-of-100 pagination, which
 * silently split a single day's roster across two "pages" the moment active
 * headcount neared/exceeded 100. Callers now page by `date`
 * (see useAttendanceDailyList), not by row offset.
 */
export async function fetchUnifiedAttendance({ date, search, filters, sortBy, sortOrder }) {
  let query = supabase
    .from("unified_daily_attendance")
    .select("*")
    .eq("work_date", date)
    .order(sortBy || "full_name", {
      ascending: sortOrder !== "descending",
    });

  // -------------------
  // SEARCH
  // -------------------

  if (search) {
    query = query.or(
      [
        `full_name.ilike.%${search}%`,
        `company_employee_code.ilike.%${search}%`,
        `department_name.ilike.%${search}%`,
      ].join(","),
    );
  }

  // -------------------
  // FILTERS
  // -------------------
  // Only columns that actually exist on unified_daily_attendance -- verified
  // against hr_unified_daily_attendance_view.sql's SELECT list. "attendanceType"
  // (app_attendance_type) and "approvalStatus" (app_approval_status) used to be
  // handled here but those columns don't exist on this view (a leftover from
  // the old per-activity `attendance_activities` model this page used to
  // query) -- hr_flag already captures approval/anomaly state, e.g.
  // "Pending App Approval".

  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") return;

    query = applyAttendanceFilter(query, key, value);
  });

  const { data, error } = await query;

  if (error) throw error;

  return {
    data: normalizeUnifiedAttendance(data || []),
    totalCount: data?.length || 0,
  };
}

// Shared by both fetchers below -- named business-window filters mirroring
// get_attendance_dashboard_rpc.sql's own thresholds exactly (09:00/18:00 for
// late/early, >8h for overtime, hr_flag exclusions for working-day/present),
// so a drill-through link's row count always matches the KPI it came from.
function applyAttendanceFilter(query, key, value) {
  switch (key) {
    case "employee":
      return query.eq("employee_uuid", value);

    case "department":
      return query.eq("department_id", value);

    case "manager":
      return query.eq("manager_id", value);

    case "hrFlag":
      return query.eq("hr_flag", value);

    case "workingDayOnly":
      return query.neq("hr_flag", "Weekend / Rest Day");

    case "presentOnly":
      return query
        .neq("hr_flag", "Weekend / Rest Day")
        .neq("hr_flag", "Absent");

    case "overtimeOnly":
      return query
        .gt("hours_worked", 8)
        .neq("hr_flag", "Weekend / Rest Day")
        .neq("hr_flag", "Absent");

    case "lateArrival":
      return query
        .not("first_in_time_of_day", "is", null)
        .gt("first_in_time_of_day", "09:00:00")
        .neq("hr_flag", "Weekend / Rest Day")
        .neq("hr_flag", "Absent");

    case "earlyLeave":
      return query
        .not("last_out_time_of_day", "is", null)
        .lt("last_out_time_of_day", "18:00:00")
        .neq("hr_flag", "Weekend / Rest Day")
        .neq("hr_flag", "Absent");

    default:
      return query;
  }
}

/**
 * Unified Daily Attendance View -- Search mode: all dates (unless narrowed
 * by an explicit startDate/endDate), row-paginated.
 *
 * Sibling to fetchUnifiedAttendance (day mode). Used the moment any of
 * Employee/Department/Manager/Status/date-range is set, or search text is
 * typed (see AttendanceManagement.jsx's isSearchMode) -- filtering by e.g.
 * one employee should show that employee's whole history, not just their
 * one row for whatever single date happened to be selected. Row-offset
 * pagination is safe here (unlike the old pre-day-mode version of this
 * page) because a secondary sort tie-break (full_name) makes results
 * deterministic across pages even when a page boundary falls mid-day --
 * that's just an ordinary paginated list now, not a bug, same as every
 * other list page in this app.
 */
export async function fetchUnifiedAttendanceSearch({
  page,
  pageSize,
  search,
  filters,
  sortBy,
  sortOrder,
}) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("unified_daily_attendance")
    .select("*", { count: "exact" })
    .order(sortBy || "work_date", { ascending: sortOrder === "ascending" })
    .order("full_name", { ascending: true });

  // -------------------
  // SEARCH
  // -------------------

  if (search) {
    query = query.or(
      [
        `full_name.ilike.%${search}%`,
        `company_employee_code.ilike.%${search}%`,
        `department_name.ilike.%${search}%`,
      ].join(","),
    );
  }

  // -------------------
  // FILTERS
  // -------------------
  // Same cases as fetchUnifiedAttendance (via the shared applyAttendanceFilter
  // helper), plus startDate/endDate -- both optional; with neither set, this
  // is genuinely all-time.

  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") return;

    if (key === "startDate") {
      query = query.gte("work_date", value);
    } else if (key === "endDate") {
      query = query.lte("work_date", value);
    } else {
      query = applyAttendanceFilter(query, key, value);
    }
  });

  query = query.range(from, to);

  const { data, count, error } = await query;

  if (error) throw error;

  return {
    data: normalizeUnifiedAttendance(data || []),
    totalCount: count || 0,
  };
}

// FORMAT
function normalizeUnifiedAttendance(rows) {
  return rows.map((row) => ({
    ...row,

    id: `${row.employee_uuid}_${row.work_date}`,

    work_date: formatDate(row.work_date),

    first_in: formatDateTime(row.first_in),
    first_in_time: formatTime(row.first_in),
    last_out: formatDateTime(row.last_out),
    last_out_time: formatTime(row.last_out),

    hw_check_in: formatDateTime(row.hw_check_in),
    hw_check_in_time: formatTime(row.hw_check_in),
    hw_check_out: formatDateTime(row.hw_check_out),
    hw_check_out_time: formatTime(row.hw_check_out),

    app_check_in: formatDateTime(row.app_check_in),
    app_check_in_time: formatTime(row.app_check_in),
    app_check_out: formatDateTime(row.app_check_out),
    app_check_out_time: formatTime(row.app_check_out),

    hours_worked:
      row.hours_worked !== null ? Number(row.hours_worked).toFixed(2) : null,
  }));
}

// API function for the Sidebar
export async function fetchEmployeeDayDetails(employeeUuid, workDate) {
  if (!employeeUuid || !workDate) return [];

  const { data, error } = await supabase
    .from("attendance_activity_audit")
    .select("*")
    .eq("employee_uuid", employeeUuid)
    .eq("work_date", workDate)
    .order("check_in_time", { ascending: true });

  if (error) throw error;

  return normalizeEmployeeDayDetails(data || []);
}

function normalizeEmployeeDayDetails(rows) {
  return rows.map((row) => ({
    ...row,

    check_in_time_only: formatTime(row.check_in_time),
    check_out_time_only: formatTime(row.check_out_time),
  }));
}
