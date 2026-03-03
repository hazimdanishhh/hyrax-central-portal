import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import useEmployee from "../hooks/useEmployee";

/**
 * Attendance Activity Context
 */

const AttendanceContext = createContext();

export function AttendanceProvider({ children }) {
  const { employee } = useEmployee();
  const [currentActivity, setCurrentActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const employeeId = employee?.id;

  async function fetchCurrent() {
    if (!employeeId) {
      setCurrentActivity(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from("attendance_activities")
      .select(`*, attendance_type:attendance_type_id(id, name)`)
      .eq("employee_id", employeeId)
      .is("clocked_out_at", null)
      .maybeSingle();

    if (error) {
      console.error("Failed to fetch current activity:", error);
      setCurrentActivity(null);
      setLoading(false);
      return;
    }

    const normalizedData = data
      ? {
          ...data,

          // CLOCK IN
          clocked_in_date: data.clocked_in_at
            ? new Date(data.clocked_in_at).toLocaleDateString("en-MY", {
                dateStyle: "medium",
              })
            : null,

          clocked_in_time: data.clocked_in_at
            ? new Date(data.clocked_in_at).toLocaleTimeString("en-MY", {
                timeStyle: "short",
              })
            : null,

          // CLOCK OUT
          clocked_out_date: data.clocked_out_at
            ? new Date(data.clocked_out_at).toLocaleDateString("en-MY", {
                dateStyle: "medium",
              })
            : null,

          clocked_out_time: data.clocked_out_at
            ? new Date(data.clocked_out_at).toLocaleTimeString("en-MY", {
                timeStyle: "short",
              })
            : null,

          clocked_in_at: data.clocked_in_at
            ? new Date(data.clocked_in_at).toLocaleString("en-MY", {
                dateStyle: "medium",
                timeStyle: "short",
              })
            : null,

          clocked_out_at: data.clocked_out_at
            ? new Date(data.clocked_out_at).toLocaleString("en-MY", {
                dateStyle: "medium",
                timeStyle: "short",
              })
            : null,
        }
      : null;

    setCurrentActivity(normalizedData);
    setLoading(false);
  }

  useEffect(() => {
    fetchCurrent();
  }, [employeeId]);

  return (
    <AttendanceContext.Provider
      value={{
        currentActivity,
        loading,
        refetchCurrent: fetchCurrent,
      }}
    >
      {children}
    </AttendanceContext.Provider>
  );
}

export function useAttendance() {
  const context = useContext(AttendanceContext);
  if (!context) {
    throw new Error("useAttendance must be used inside AttendanceProvider");
  }
  return context;
}
