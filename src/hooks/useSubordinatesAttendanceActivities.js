import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useMessage } from "../context/MessageContext";
import useEmployee from "./useEmployee";

/**
 * Hook to fetch the attendance activities of current logged in employee's team members
 */
export default function useSubordinatesAttendanceActivities() {
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
    showMessage("Loading team attendance", "loading");

    try {
      // ✅ Step 1: Get subordinates
      const { data: subordinates, error: subError } = await supabase
        .from("employees_public")
        .select("*")
        .eq("manager_id", employee.id);

      if (subError) throw subError;

      const subordinateIds = subordinates.map((e) => e.id);

      if (!subordinateIds.length) {
        setAttendanceActivities([]);
        setLoading(false);
        return;
      }

      // ✅ Step 2: Fetch their attendance
      const { data, error } = await supabase
        .from("attendance_activities")
        .select(
          `
            *,
            attendance_type:attendance_type_id(id, name),
            employee:employee_id(id, full_name, preferred_name, profile:profiles!profile_id(avatar_url)),
            approved_by:employees_public!approved_by(
              id,
              preferred_name,
              profile:profiles!profile_id(avatar_url)
            )
          `,
        )
        .in("employee_id", subordinateIds)
        .order("approval_status", { ascending: true, foreignTable: null }) // optional, we’ll override with case
        .order("clocked_in_at", { ascending: false });

      if (error) throw error;

      // ✅ Normalize (same as your original hook)
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
        employee_full_name: activity.employee?.full_name || "",
      }));

      console.log(normalizedData);

      setAttendanceActivities(normalizedData || []);
      showMessage("Team attendance loaded", "success");
    } catch (err) {
      console.error("Failed to fetch subordinates attendance:", err);
      showMessage("Failed to load team attendance", "error");
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
