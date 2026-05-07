// src/hooks/attendanceActivities/useAttendanceActivityMutations.js
import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useMessage } from "../../context/MessageContext";

/**
 * Hook to Create, Update and Delete attendance activities for HR department
 */

export default function useAttendanceActivityMutations() {
  const { showMessage } = useMessage();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);

  // =============
  // UPDATE ATTENDANCE ACTIVITY
  // =============
  const updateAttendanceActivity = async (updatedData) => {
    try {
      setSaving(true);
      setError(null);
      showMessage("Updating attendance activity", "loading");

      const { id, ...rawFields } = updatedData;

      // Clean and normalize data before sending to Supabase
      const updateFields = Object.fromEntries(
        Object.entries(rawFields)
          .filter(([_, value]) => value !== undefined) // remove undefined
          .map(([key, value]) => {
            // Convert empty strings to null
            if (value === "") return [key, null];

            // Convert *_id fields to integers
            if (key.endsWith("_id") && value !== null) {
              const isNumeric =
                typeof value === "string" && /^\d+$/.test(value);

              return [key, isNumeric ? Number(value) : value];
            }

            return [key, value];
          }),
      );

      // Update +
      const { data, error } = await supabase
        .from("attendance_activities")
        .update(updateFields)
        .eq("id", id)
        .select(`*, attendance_type:attendance_type_id(id, name)`)
        .maybeSingle();

      if (error) throw error;
      showMessage("Attendance updated", "success");

      return data;
    } catch (err) {
      console.error("Failed to update attendance, please try again", err);
      setError(err);
      let userFriendlyMessage = "An unexpected error occurred.";

      // Handle specific Postgres codes
      switch (err.code) {
        case "23505":
          // Extract the field name from the error detail or message
          if (err.message.includes("clock_in_at")) {
            userFriendlyMessage =
              "An attendance with this clock in date already exists.";
          } else if (err.message.includes("clock_out_at")) {
            userFriendlyMessage =
              "An attendance with this clock out date already exists.";
          } else {
            userFriendlyMessage =
              "A record with this information already exists. Only one active attendance activity per employee";
          }
          break;

        case "23503":
          userFriendlyMessage =
            "This record is linked to other data and cannot be changed or removed.";
          break;

        case "42501":
          userFriendlyMessage =
            "Permission denied. You aren't authorized to modify attendance.";
          break;

        default:
          userFriendlyMessage = err.message || "Failed to save changes.";
      }

      showMessage(userFriendlyMessage, "error");
    } finally {
      setSaving(false);
    }
  };

  // =============
  // CREATE ATTENDANCE ACTIVITY
  // =============
  const createAttendanceActivity = async (newData) => {
    try {
      setSaving(true);
      setError(null);
      showMessage("Creating attendance", "loading");

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
        .select(`*, attendance_type:attendance_type_id(id, name)`)
        .maybeSingle();

      if (error) throw error;

      showMessage("Attendance created", "success");

      return data;
    } catch (err) {
      console.error("Failed to create attendance:", err);
      setError(err);

      let userFriendlyMessage = "An unexpected error occurred.";

      // Handle specific Postgres codes
      switch (err.code) {
        case "23505":
          // Extract the field name from the error detail or message
          if (err.message.includes("clock_in_at")) {
            userFriendlyMessage =
              "An attendance with this clock in date already exists.";
          } else if (err.message.includes("clock_out_at")) {
            userFriendlyMessage =
              "An attendance with this clock out date already exists.";
          } else {
            userFriendlyMessage =
              "A record with this information already exists. Only one active attendance activity per employee";
          }
          break;

        case "23503":
          userFriendlyMessage =
            "This record is linked to other data and cannot be changed or removed.";
          break;

        case "42501":
          userFriendlyMessage =
            "Permission denied. You aren't authorized to modify attendance.";
          break;

        default:
          userFriendlyMessage = err.message || "Failed to save changes.";
      }

      showMessage(userFriendlyMessage, "error");
      throw err;
    } finally {
      setSaving(false);
    }
  };

  // =============
  // DELETE ATTENDANCE ACTIVITY
  // =============
  const deleteAttendanceActivity = async (attendanceActivityId) => {
    try {
      setDeleting(true);
      setError(null);
      showMessage("Deleting attendance activity", "loading");

      const { error } = await supabase
        .from("attendance_activities")
        .delete()
        .eq("id", attendanceActivityId);

      if (error) throw error;

      showMessage("Attendance deleted", "success");

      return true;
    } catch (err) {
      console.error("Failed to delete attendance, please try again:", err);
      setError(err);

      showMessage("Failed to delete attendance, please try again", "error");

      throw err;
    } finally {
      setDeleting(false);
    }
  };

  // =============
  // CLOCK OUT ATTENDANCE ACTIVITY
  // =============
  const clockOutAttendanceActivity = async (id) => {
    try {
      setSaving(true);
      showMessage("Clocking out attendance", "loading");

      const { data, error } = await supabase
        .from("attendance_activities")
        .update({
          clocked_out_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select(`*, attendance_type:attendance_type_id(id, name)`)
        .maybeSingle();

      if (error) throw error;

      showMessage("Attendance clocked out", "success");
      return data;
    } catch (err) {
      console.error("Clock out failed:", err);
      showMessage("Clock out failed", "error");
    } finally {
      setSaving(false);
    }
  };

  return {
    createAttendanceActivity,
    updateAttendanceActivity,
    deleteAttendanceActivity,
    clockOutAttendanceActivity,
    saving,
    deleting,
    error,
  };
}
