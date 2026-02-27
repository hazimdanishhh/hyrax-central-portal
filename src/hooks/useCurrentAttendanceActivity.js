import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function useCurrentAttendanceActivity(employeeId) {
  const [currentActivity, setCurrentActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ text: "", type: "" });

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

    setMessage({
      text: "Successfully retrieved current activity",
      type: "success",
    });

    setLoading(false);
  }

  useEffect(() => {
    fetchCurrent();
  }, [employeeId]);

  return {
    currentActivity,
    loading,
    refetchCurrent: fetchCurrent,
  };
}
