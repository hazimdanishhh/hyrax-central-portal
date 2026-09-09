import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useEmployee } from "./EmployeeContext";

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

          // Raw ISO timestamp, kept alongside the formatted clocked_in_at
          // below (which overwrites the raw value under the same key) --
          // consumers doing elapsed-time math (e.g. useElapsedSince) need
          // an actually-parseable value, not a locale-formatted string.
          clocked_in_at_raw: data.clocked_in_at,

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

  // A biometric door scan auto-closes any open app session server-side
  // (supabase/triggers/trigger_auto_clock_out.sql), without this context
  // knowing until something refetches -- self-heal on window focus and on a
  // slow interval, rather than only on employeeId change/remount, so the
  // Clock In/Out button (and anything else reading currentActivity) doesn't
  // sit stale for an entire session.
  useEffect(() => {
    if (!employeeId) return;

    function handleFocus() {
      fetchCurrent();
    }

    window.addEventListener("focus", handleFocus);
    const interval = setInterval(fetchCurrent, 5 * 60 * 1000);

    return () => {
      window.removeEventListener("focus", handleFocus);
      clearInterval(interval);
    };
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
