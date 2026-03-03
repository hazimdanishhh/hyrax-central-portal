import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useMessage } from "../context/MessageContext";

export default function useAttendanceActivityMutations() {
  const { showMessage } = useMessage();
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
      showMessage("Creating Attendance...", "loading");

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

      showMessage("Attendance created", "success");

      return data;
    } catch (err) {
      console.error("Failed to create attendance:", err);
      setError(err);
      showMessage("Failed to create attendance", "error");

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
      showMessage("Clocking Out...", "loading");

      const { data, error } = await supabase
        .from("attendance_activities")
        .update({
          clocked_out_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .maybeSingle();

      if (error) throw error;

      showMessage("Attendance Clocked Out", "success");
      return data;
    } catch (err) {
      console.error("Failed to clock out attendance:", err);
      showMessage("Failed to clock out attendance", "error");
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
