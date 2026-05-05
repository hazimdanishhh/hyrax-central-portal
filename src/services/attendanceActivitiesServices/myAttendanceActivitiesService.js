// services/myAttendanceActivitiesService.js
import useEmployee from "../../hooks/useEmployee";
import { supabase } from "../../lib/supabaseClient";

/**
 * Fetch current logged in employee's attendance activities
 */
export async function fetchMyAttendanceActivities({
  page,
  pageSize,
  search,
  filters,
  sortBy,
  sortOrder,
}) {
  const { employee } = useEmployee();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  if (!employee?.id) {
    return [];
  }

  let query = supabase
    .from("attendance_activities")
    .select(
      `
            *,
            attendance_type:attendance_type_id(id, name),
            approved_by:employees_public!approved_by(id, full_name,
              profile:profiles!profile_id(avatar_url)
              )
          `,
      { count: "exact" },
    )
    .eq("employee_id", employee.id)
    .order(sortBy, { ascending: sortOrder === "ascending" });

  // --- SEARCH ---
  if (search) {
    query = query.or(
      `employee_id.ilike.%${search}%,full_name.ilike.%${search}%`,
    );
  }

  // --- FILTERS ---
  Object.entries(filters).forEach(([key, value]) => {
    if (!value) return;

    const map = {
      employee: "employee_id",
      attendanceType: "attendance_type_id",
      approvedBy: "approved_by",
      approvalStatus: "approval_status",
    };

    if (map[key]) query = query.eq(map[key], value);
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
 * Keep raw DB fields untouched for CRUD/update usage.
 * Add UI-safe derived fields separately.
 */
function normalizeAttendanceActivities(rows) {
  return rows.map((activity) => ({
    ...activity,

    // KEEP ORIGINAL timestamptz values:
    // clocked_in_at
    // clocked_out_at
    // approved_at

    // Human-readable display fields
    clocked_in_display: formatDateTime(activity.clocked_in_at),
    clocked_out_display: formatDateTime(activity.clocked_out_at),
    approved_display: formatDateTime(activity.approved_at),

    // HTML input[type="date"] compatible fields
    clocked_in_date: formatInputDate(activity.clocked_in_at),
    clocked_out_date: formatInputDate(activity.clocked_out_at),
    approved_date: formatInputDate(activity.approved_at),

    // Optional time-only display
    clocked_in_time: formatTime(activity.clocked_in_at),
    clocked_out_time: formatTime(activity.clocked_out_at),
    approved_time: formatTime(activity.approved_at),
  }));
}

function formatInputDate(value) {
  if (!value) return null;

  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`; // yyyy-MM-dd
}

function formatDateTime(value) {
  if (!value) return null;

  return new Date(value).toLocaleString("en-MY", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatTime(value) {
  if (!value) return null;

  return new Date(value).toLocaleTimeString("en-MY", {
    timeStyle: "short",
  });
}
