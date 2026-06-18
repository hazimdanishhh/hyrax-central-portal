// features/hr/attendance/private/api/attendanceOverviewService.js

import { supabase } from "../../../../../lib/supabaseClient";

/**
 * Unified Daily Attendance View
 * Source: unified_daily_attendance
 */
export async function fetchUnifiedAttendance({
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
    .order(sortBy || "work_date", {
      ascending: sortOrder === "ascending",
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

  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") return;

    switch (key) {
      case "employee":
        query = query.eq("employee_uuid", value);
        break;

      case "department":
        query = query.eq("department_id", value);
        break;

      case "manager":
        query = query.eq("manager_id", value);
        break;

      case "approvalStatus":
        query = query.eq("app_approval_status", value);
        break;

      case "attendanceType":
        query = query.eq("app_attendance_type", value);
        break;

      case "hrFlag":
        query = query.eq("hr_flag", value);
        break;

      case "startDate":
        query = query.gte("work_date", value);
        break;

      case "endDate":
        query = query.lte("work_date", value);
        break;

      default:
        break;
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

function formatDateTime(value) {
  if (!value) return null;

  return new Date(value).toLocaleString("en-MY", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatDate(value) {
  if (!value) return null;

  return new Date(value).toLocaleDateString("en-MY", {
    dateStyle: "medium",
  });
}

function formatTime(value) {
  if (!value) return null;

  return new Date(value).toLocaleTimeString("en-MY", {
    timeStyle: "short",
  });
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
