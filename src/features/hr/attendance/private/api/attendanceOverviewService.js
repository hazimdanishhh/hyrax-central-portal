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
    .eq("work_date", date);

  query = applyAttendanceSort(
    query,
    sortBy || "full_name",
    sortOrder !== "descending",
  );

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

// Shared by both fetchers below -- builds the FULL multi-column .order()
// chain for whichever single field the SortBar UI's dropdown chose, rather
// than sorting by just that one column. The chosen ascending/descending
// toggle applies ONLY to that primary column; two fixed tie-breaks are
// then appended in this order (skipping either one that IS already the
// primary column, to avoid ordering by the same column twice):
//   1. full_name ascending -- a human-friendly, deterministic secondary
//      order. Also what makes Search mode's row-offset pagination stable
//      across pages (see fetchUnifiedAttendanceSearch's own comment).
//   2. work_date descending -- most recent day first. A no-op in Day mode
//      (every row already shares one date -- see fetchUnifiedAttendance's
//      own comment), genuinely meaningful in Search mode (rows span many
//      dates).
// These two tie-break directions are fixed, not user-configurable --
// flipping "sort by Department" to descending should reverse department
// order, not also flip "most recent date first" to oldest-first; the two
// concerns are independent. The user asked for exactly this shape for two
// concrete cases (Employee Name -> secondary date descending; Department ->
// name then date) -- generalized here to every sort option (Hours Worked,
// Status, First In, Last Out too) rather than special-casing just those
// two, since the same "name, then most-recent-date" tie-break reads
// sensibly regardless of the primary column chosen.
//
// Final tie-break: employee_uuid, always, unconditionally (it's never a
// sort option a user can pick, so no skip-check needed). Two employees can
// share the same full_name -- without this, their rows for the same date
// would have no deterministic relative order, which would let Search
// mode's row-offset pagination silently show a row twice or skip one
// across a page boundary.
function applyAttendanceSort(query, primaryColumn, primaryAscending) {
  let q = query.order(primaryColumn, { ascending: primaryAscending });

  if (primaryColumn !== "full_name") {
    q = q.order("full_name", { ascending: true });
  }
  if (primaryColumn !== "work_date") {
    q = q.order("work_date", { ascending: false });
  }

  return q.order("employee_uuid", { ascending: true });
}

// Shared by both fetchers below -- named business-window filters mirroring
// get_attendance_dashboard_rpc.sql's own thresholds exactly (09:00 late
// arrival, overtime/early-leave read from unified_daily_attendance's
// overtime_hours/is_early_leave columns -- after 6PM / before 5PM,
// respectively, not hours_worked-based), so a drill-through link's row
// count always matches the KPI it came from.
function applyAttendanceFilter(query, key, value) {
  switch (key) {
    case "employee":
      return query.eq("employee_uuid", value);

    case "department":
      return query.eq("department_id", value);

    case "workLocation":
      return query.eq("work_location_id", value);

    case "manager":
      return query.eq("manager_id", value);

    case "hrFlag":
      return query.eq("hr_flag", value);

    case "dayType":
      // Merged "Working Days Only"/"Weekend Only" into one filter -- they
      // were previously two separate dropdown entries that were really just
      // opposite ends of the same is_weekend boolean.
      if (value === "working") return query.eq("is_weekend", false);
      if (value === "weekend") return query.eq("is_weekend", true);
      return query;

    case "presentOnly":
      // "Present" means hr_flag isn't Absent and isn't an unworked Public
      // Holiday -- NOT is_weekend = false. An unworked weekend already
      // reads hr_flag = "Absent" (hr_flag no longer has a "Weekend / Rest
      // Day" value at all), so excluding "Absent" alone already excludes
      // it; a separate is_weekend exclusion would ALSO wrongly exclude a
      // worked Saturday (hr_flag = "Approved"/etc.) even though the
      // employee clearly was present that day -- that was a real bug.
      // hr_flag only ever reads "Public Holiday (...)" on a day with zero
      // real attendance (a worked holiday falls through to Approved/OK/etc
      // instead), so excluding that prefix can never wrongly exclude a
      // worked day either, mirroring exactly how excluding "Absent" can't.
      return query
        .neq("hr_flag", "Absent")
        .not("hr_flag", "ilike", "Public Holiday%");

    case "onLeave":
      return query.eq("is_on_leave", true);

    case "overtimeOnly":
      // Overtime is time worked after 6PM (unified_daily_attendance's
      // overtime_hours column), not hours_worked > 8.
      return query
        .gt("overtime_hours", 0)
        .eq("is_weekend", false)
        .neq("hr_flag", "Absent");

    case "lateArrival":
      // Late arrival is now computed once in unified_daily_attendance
      // (is_late_arrival, same 09:00 threshold), matching earlyLeave's own
      // is_early_leave pattern below -- so this filter and
      // get_attendance_dashboard_rpc.sql's lateArrivalsCount KPI can never
      // silently disagree.
      return query
        .eq("is_late_arrival", true)
        .eq("is_weekend", false)
        .neq("hr_flag", "Absent");

    case "earlyLeave":
      // Early leave is before 5PM (unified_daily_attendance's
      // is_early_leave column, company-wide flat threshold for now).
      return query
        .eq("is_early_leave", true)
        .eq("is_weekend", false)
        .neq("hr_flag", "Absent");

    // HR2000 leave/attendance conflict detection -- all three already
    // tightly scoped by daily_leave's leave_day_fraction_total in the view
    // itself, unlike overtimeOnly/lateArrival/earlyLeave above, so no
    // Weekend/Absent hr_flag exclusion is needed here.
    case "leaveAttendanceConflict":
      return query.eq("is_leave_attendance_conflict", true);

    case "insufficientHalfDayHours":
      return query.eq("is_insufficient_half_day_hours", true);

    case "leaveFractionError":
      return query.eq("has_leave_fraction_error", true);

    case "publicHoliday":
      return query.eq("is_public_holiday", true);

    case "workedOnHoliday":
      return query.eq("is_worked_on_holiday", true);

    case "workedOnWeekend":
      return query.eq("is_worked_on_weekend", true);

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
 * page) because applyAttendanceSort's tie-break chain (full_name, then
 * work_date) makes results deterministic across pages even when a page
 * boundary falls mid-day -- that's just an ordinary paginated list now,
 * not a bug, same as every other list page in this app.
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
    .select("*", { count: "exact" });

  query = applyAttendanceSort(
    query,
    sortBy || "work_date",
    sortOrder === "ascending",
  );

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
