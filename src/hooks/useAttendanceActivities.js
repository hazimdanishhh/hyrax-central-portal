// src/hooks/useAttendanceActivities.js
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

/**
 * Hook to fetch the attendance activity types
 * This is HR / IT data
 */
export default function useAttendanceActivities() {
  const [attendanceActivities, setAttendanceActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAttendanceTypes = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error } = await supabase
          .from("attendance_activities")
          .select(`*, attendance_type:attendance_type_id(id, name)`)
          .order("id");

        if (error) throw error;

        if (!data) {
          setAttendanceActivities([]);
          return;
        }

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
        }));

        setAttendanceActivities(normalizedData);
      } catch (err) {
        console.error("Failed to fetch attendance activities data:", err);
        setError(err);
        setAttendanceActivities([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAttendanceTypes();
  }, []);

  return { attendanceActivities, setAttendanceActivities, loading, error };
}
