// src/hooks/useEmployee.js
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useMessage } from "../context/MessageContext";

/**
 * Hook to fetch all employee records
 * This is private HR / employment data
 * Future enhancement: can pass filters like departmentId, userId, categoryId, etc.
 */
export default function useEmployees() {
  const { showMessage } = useMessage();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // =============
  // FETCH EMPLOYEES
  // =============
  const fetchEmployees = async () => {
    setLoading(true);
    setError(null);
    showMessage("Loading employees", "loading");

    try {
      let query = supabase
        .from("employees")
        .select(
          `
            *,
            profile:profile_id (*),
            identification_type:identification_type_id (
              id,
              name
            ),
            nationality:nationality_id (
              id,
              name
            ),
            department:departments (
            id,
            name,
            sub
            ),
            manager:manager_id (
              id,
              employee_id,
              full_name,
              preferred_name,
              email_work,
              phone_work,
              position,
              department:departments (
                id,
                name,
                sub
              )
            ),
            employment_status:employment_status_id (
              id,
              name
            ),
            employment_type:employment_type_id (
              id,
              name
            ),
            termination_reason:termination_reason_id (
              id,
              name
            )
          `,
        )
        .order("full_name", { ascending: true });

      const { data, error } = await query;

      if (error) throw error;

      setEmployees(data || []);
      showMessage("Employees loaded", "success");
    } catch (err) {
      setError(err);
      setEmployees([]);
      showMessage("Failed to load employees", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  return { employees, setEmployees, loading, error, refetch: fetchEmployees };
}
