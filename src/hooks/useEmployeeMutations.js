// src/hooks/useEmployeeMutations.js
import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useMessage } from "../context/MessageContext";

/**
 * Hook to Create, Update and Delete employees for HR department
 */

export default function useEmployeeMutations() {
  const { showMessage } = useMessage();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);

  // =============
  // UPDATE EMPLOYEE
  // =============
  const updateEmployee = async (updatedData) => {
    try {
      setSaving(true);
      setError(null);
      showMessage("Updating employee", "loading");

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
        .from("employees")
        .update(updateFields)
        .eq("id", id)
        .select(
          `
          *,
          profile:profile_id (*),
          identification_type:identification_type_id (id,name),
          nationality:nationality_id (id,name),
          department:departments (id,name,sub),
          manager:manager_id (id,employee_id,full_name,preferred_name,email_work,phone_work,position,
            department:departments (id,name,sub)),
          employment_status:employment_status_id (id,name),
          employment_type:employment_type_id (id,name),
          termination_reason:termination_reason_id (id,name)
          `,
        )
        .maybeSingle();

      if (error) throw error;
      showMessage("Employee updated", "success");

      return data;
    } catch (err) {
      console.error("Failed to update employee, please try again", err);
      setError(err);
      showMessage("Failed to update employee, please try again", "error");

      throw err;
    } finally {
      setSaving(false);
    }
  };

  // =============
  // CREATE ASSET
  // =============
  const createEmployee = async (newData) => {
    try {
      setSaving(true);
      setError(null);
      showMessage("Creating employee", "loading");

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
        .from("employees")
        .insert(insertFields)
        .select(
          `
          *,
          profile:profile_id (*),
          identification_type:identification_type_id (id,name),
          nationality:nationality_id (id,name),
          department:departments (id,name,sub),
          manager:manager_id (id,employee_id,full_name,preferred_name,email_work,phone_work,position,
            department:departments (id,name,sub)),
          employment_status:employment_status_id (id,name),
          employment_type:employment_type_id (id,name),
          termination_reason:termination_reason_id (id,name)
          `,
        )
        .maybeSingle();

      if (error) throw error;

      showMessage("Employee created", "success");

      return data;
    } catch (err) {
      console.error("Failed to create employee, please try again:", err);
      setError(err);
      showMessage("Failed to create employee, please try again", "error");

      throw err;
    } finally {
      setSaving(false);
    }
  };

  // =============
  // DELETE ASSET
  // =============
  const deleteEmployee = async (employeeId) => {
    try {
      setDeleting(true);
      setError(null);
      showMessage("Deleting employee", "loading");

      const { error } = await supabase
        .from("employees")
        .delete()
        .eq("id", employeeId);

      if (error) throw error;

      showMessage("Employee deleted", "success");

      return true;
    } catch (err) {
      console.error("Failed to delete employee, please try again:", err);
      setError(err);

      showMessage("Failed to delete employee, please try again", "error");

      throw err;
    } finally {
      setDeleting(false);
    }
  };

  return {
    createEmployee,
    updateEmployee,
    deleteEmployee,
    saving,
    deleting,
    error,
  };
}
