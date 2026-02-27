import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function useAttendanceActivityMutations({ setMessage } = {}) {
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);

  // =============
  // CREATE ATTENDANCE ACTIVITY
  // =============
  const createAttendanceActivity = async (newData) => {
    try {
      setSaving(true);
      setError(null);

      const { id, ...rawFields } = newData; // ignore id if accidentally passed

      const insertFields = Object.fromEntries(
        Object.entries(rawFields)
          .filter(([_, value]) => value !== undefined)
          .map(([key, value]) => {
            if (value === "") return [key, null];

            if (key.endsWith("_id") && value !== null) {
              const isNumeric =
                typeof value === "string" && /^\d+$/.test(value);

              return [key, isNumeric ? Number(value) : value];
            }

            return [key, value];
          }),
      );

      const { data, error } = await supabase
        .from("attendance_activities")
        .insert(insertFields)
        .select(
          `
        *,
        attendance_type:attendance_type_id (id, name, requires_photo, requires_location)
      `,
        )
        .single();

      if (error) throw error;

      setMessage?.({
        type: "success",
        text: "Attendance activity created successfully.",
      });
      console.log("successfully created attendance");

      return data;
    } catch (err) {
      console.error("Failed to create asset:", err);
      setError(err);
      setMessage?.({
        type: "error",
        text: "Failed to create asset.",
      });
      throw err;
    } finally {
      setSaving(false);
    }
  };

  // =============
  // CLOCK OUT ATTENDANCE ACTIVITY
  // =============
  const clockOutAttendanceActivity = async (id) => {
    try {
      setSaving(true);

      const { data, error } = await supabase
        .from("attendance_activities")
        .update({
          clocked_out_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .maybeSingle();

      if (error) throw error;

      return data;
    } finally {
      setSaving(false);
    }
  };

  return {
    createAttendanceActivity,
    clockOutAttendanceActivity,
    saving,
    deleting,
    error,
  };
}
