// services/myAttendanceActivitiesService.js
import { supabase } from "../../lib/supabaseClient";

/**
 * Fetch current logged in employee's attendance activities
 */
export async function fetchMyAttendanceActivities({
  employeeId,
  page,
  pageSize,
  search,
  filters,
  sortBy,
  sortOrder,
}) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  console.log("🔥 fetchMyAttendanceActivities INPUT:", {
    employeeId,
    page,
    pageSize,
    search,
    filters,
    sortBy,
    sortOrder,
  });

  let query = supabase
    .from("attendance_activities_hr_view")
    .select(`*`, { count: "exact" })
    .eq("employee_id", employeeId)
    .order(sortBy, { ascending: sortOrder === "ascending" });

  if (!employeeId) {
    return {
      data: [],
      totalCount: 0,
    };
  }

  // --- SEARCH ---
  if (search) {
    query = query.or(`employee.full_name.ilike.%${search}%`);
  }

  // --- FILTERS ---
  Object.entries(filters).forEach(([key, value]) => {
    if (!value) return;

    const map = {
      attendanceType: "attendance_type_id",
      approvedBy: "approved_by",
      approvalStatus: "approval_status",
    };

    if (map[key]) query = query.eq(map[key], value);

    // DATE RANGE FILTERS
    if (key === "startDate") {
      query = query.gte("clocked_in_at", `${value}T00:00:00`);
    }

    if (key === "endDate") {
      query = query.lte("clocked_in_at", `${value}T23:59:59`);
    }
  });

  // paginate LAST
  query = query.range(from, to);

  const { data, count, error } = await query;

  if (error) throw error;

  return {
    data: normalizeAttendanceActivities(data || []),
    totalCount: count || 0,
  };
}

/**
 * Normalize returned attendance data
 */
function normalizeAttendanceActivities(rows) {
  return rows.map((activity) => ({
    ...activity,

    clocked_in_at: formatDateTime(activity.clocked_in_at),
    clocked_out_at: formatDateTime(activity.clocked_out_at),
    approved_at: formatDateTime(activity.approved_at),

    clocked_in_date: formatDate(activity.clocked_in_at),
    clocked_in_time: formatTime(activity.clocked_in_at),

    clocked_out_date: formatDate(activity.clocked_out_at),
    clocked_out_time: formatTime(activity.clocked_out_at),
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
