// src/hooks/useAttendanceTypes.js
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

/**
 * Hook to fetch the attendance activity types
 * This is HR / IT data
 */
export default function useAttendanceTypes() {
  const [attendanceTypes, setAttendanceTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAttendanceTypes = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error } = await supabase
          .from("attendance_types")
          .select(`*`)
          .order("id");

        if (error) throw error;

        if (!data) {
          setAttendanceTypes(null);
          return;
        }

        setAttendanceTypes(data);
      } catch (err) {
        console.error("Failed to fetch attendance types data:", err);
        setError(err);
        setAttendanceTypes(null);
      } finally {
        setLoading(false);
      }
    };

    fetchAttendanceTypes();
  }, []);

  return { attendanceTypes, loading, error };
}
