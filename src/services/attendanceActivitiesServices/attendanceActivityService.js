// services/attendanceActivitiesService.js

import { supabase } from "../../lib/supabaseClient";

/**
 * Service to fetch 1 attendance activity for detail page
 */
export async function fetchAttendanceActivity(attendanceId) {
  const { data, error } = await supabase
    .from("attendance_activities_hr_view")
    .select("*")
    .eq("id", attendanceId)
    .single();

  if (error) throw error;

  return normalizeAttendanceActivities([data])[0];
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
