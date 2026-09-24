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

    // .order().limit(1) rather than a bare .maybeSingle().
    //
    // A partial unique index now makes more than one open session per employee
    // impossible (attendance_activities_open_session_constraint.sql), but this
    // query is what turned that situation from a nuisance into an unrecoverable
    // one, so it is worth making structurally safe rather than relying on the
    // constraint alone:
    //
    //   two open rows -> .maybeSingle() returns PGRST116 -> the catch below set
    //   currentActivity = null -> the widget decided the employee was NOT
    //   clocked in and offered "Clock In" -> the next click made a third row.
    //
    // Newest-first is the honest pick if a duplicate ever does exist: it is the
    // session the employee just started and expects to be able to close.
    const { data, error } = await supabase
      .from("attendance_activities")
      .select(`*, attendance_type:attendance_type_id(id, name)`)
      .eq("employee_id", employeeId)
      .is("clocked_out_at", null)
      .order("clocked_in_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      // Deliberately does NOT clear currentActivity. A failed FETCH tells us
      // nothing about whether a session is open -- and assuming "not clocked
      // in" is the dangerous assumption, because it invites a duplicate
      // clock-in. Keeping the last known state means a transient network
      // error shows a stale Clock Out button rather than a wrong Clock In one.
      console.error("Failed to fetch current activity:", error);
      setLoading(false);
      return;
    }

    // Pinned to Asia/Kuala_Lumpur explicitly. "en-MY" is a LOCALE (controls
    // date order, AM/PM style, etc.), not a timezone -- toLocaleString and
    // friends fall back to the VIEWER'S OWN DEVICE timezone when `timeZone`
    // isn't passed, so a session on a device set to a different timezone
    // would see its own clock-in/out shown at the wrong date and time, even
    // though the stored timestamptz value is correct. Same reasoning
    // formatDate.js's toMYTTimeInputValue/toMYTDatePart already apply.
    const displayOptions = { timeZone: "Asia/Kuala_Lumpur" };

    const normalizedData = data
      ? {
          ...data,

          // CLOCK IN
          clocked_in_date: data.clocked_in_at
            ? new Date(data.clocked_in_at).toLocaleDateString("en-MY", {
                ...displayOptions,
                dateStyle: "medium",
              })
            : null,

          clocked_in_time: data.clocked_in_at
            ? new Date(data.clocked_in_at).toLocaleTimeString("en-MY", {
                ...displayOptions,
                timeStyle: "short",
              })
            : null,

          // CLOCK OUT
          clocked_out_date: data.clocked_out_at
            ? new Date(data.clocked_out_at).toLocaleDateString("en-MY", {
                ...displayOptions,
                dateStyle: "medium",
              })
            : null,

          clocked_out_time: data.clocked_out_at
            ? new Date(data.clocked_out_at).toLocaleTimeString("en-MY", {
                ...displayOptions,
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
                ...displayOptions,
                dateStyle: "medium",
                timeStyle: "short",
              })
            : null,

          clocked_out_at: data.clocked_out_at
            ? new Date(data.clocked_out_at).toLocaleString("en-MY", {
                ...displayOptions,
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
