// src/hooks/useEmployeeAttendanceActivities.js

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useMessage } from "../context/MessageContext";
import useEmployee from "./useEmployee";

export default function useEmployeeAttendanceActivities() {
  const { showMessage } = useMessage();
  const { employee } = useEmployee();

  const [attendanceActivities, setAttendanceActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!employee?.id) {
      setAttendanceActivities([]);
      setLoading(false);
      return;
    }

    const fetchEmployeeAttendance = async () => {
      setLoading(true);
      setError(null);
      showMessage("Loading your attendance", "loading");

      try {
        const { data, error } = await supabase
          .from("attendance_activities")
          .select(
            `
            *,
            attendance_type:attendance_type_id(id, name)
          `,
          )
          .eq("employee_id", employee.id)
          .order("clocked_in_at", { ascending: false });

        if (error) throw error;

        setAttendanceActivities(data || []);
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

    fetchEmployeeAttendance();
  }, [employee?.id]);

  return {
    attendanceActivities,
    setAttendanceActivities,
    loading,
    error,
  };
}
