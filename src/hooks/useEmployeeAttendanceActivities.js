// src/hooks/useEmployeeAttendanceActivities.js

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useMessage } from "../context/MessageContext";
import { useEmployee } from "../context/EmployeeContext";

/**
 * Hook to fetch the attendance activities of current logged in employee
 */
export default function useEmployeeAttendanceActivities() {
  const { showMessage } = useMessage();
  const { employee } = useEmployee();

  const [attendanceActivities, setAttendanceActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAttendance = async () => {
    if (!employee?.id) {
      setAttendanceActivities([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    showMessage("Loading your attendance", "loading");

    try {
      const { data, error } = await supabase
        .from("attendance_activities")
        .select(
          `
            *,
            attendance_type:attendance_type_id(id, name),
            approved_by:employees_public!approved_by(id, full_name, profile:profiles!profile_id(avatar_url))
          `,
        )
        .eq("employee_id", employee.id)
        .order("clocked_in_at", { ascending: false });

      if (error) throw error;

      // Normalize clocked_in_at and clocked_out_at time
      const normalizedData = data.map((activity) => ({
        ...activity,
        clocked_in_at: activity.clocked_in_at
          ? new Date(activity.clocked_in_at).toLocaleString("en-MY", {
              dateStyle: "medium",
              timeStyle: "short",
            })
          : null,
        clocked_out_at: activity.clocked_out_at
          ? new Date(activity.clocked_out_at).toLocaleString("en-MY", {
              dateStyle: "medium",
              timeStyle: "short",
            })
          : null,
        approved_at: activity.approved_at
          ? new Date(activity.approved_at).toLocaleString("en-MY", {
              dateStyle: "medium",
              timeStyle: "short",
            })
          : null,
        // CLOCK IN
        clocked_in_date: activity.clocked_in_at
          ? new Date(activity.clocked_in_at).toLocaleDateString("en-MY", {
              dateStyle: "medium",
            })
          : null,

        clocked_in_time: activity.clocked_in_at
          ? new Date(activity.clocked_in_at).toLocaleTimeString("en-MY", {
              timeStyle: "short",
            })
          : null,

        // CLOCK OUT
        clocked_out_date: activity.clocked_out_at
          ? new Date(activity.clocked_out_at).toLocaleDateString("en-MY", {
              dateStyle: "medium",
            })
          : null,

        clocked_out_time: activity.clocked_out_at
          ? new Date(activity.clocked_out_at).toLocaleTimeString("en-MY", {
              timeStyle: "short",
            })
          : null,
      }));

      console.log(normalizedData);

      setAttendanceActivities(normalizedData || []);
      showMessage("Attendance loaded", "success");
    } catch (err) {
      console.error("Failed to fetch employee attendance:", err);
      showMessage("Failed to load attendance", "error");
      setError(err);
      setAttendanceActivities([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, [employee?.id]);

  return {
    attendanceActivities,
    setAttendanceActivities,
    refetch: fetchAttendance,
    loading,
    error,
  };
}
