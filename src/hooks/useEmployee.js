// src/hooks/useEmployee.js
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";

/**
 * Hook to fetch the current logged-in user's employee record
 * This is HR / employment data
 */
export default function useEmployee() {
  const { session } = useAuth();
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!session?.user) {
      setEmployee(null);
      setLoading(false);
      return;
    }

    const fetchEmployee = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error } = await supabase
          .from("employees")
          .select(
            `
            *,
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
          .eq("profile_id", session.user.id)
          .maybeSingle();

        if (error) throw error;

        if (!data) {
          setEmployee(null);
          return;
        }

        /**
         * Optional fallback:
         * If HR hasn't filled full_name yet,
         * use Google Workspace name so UI doesn't look empty
         */
        setEmployee({
          ...data,

          full_name:
            data.full_name || session.user.user_metadata?.full_name || null,

          email_work: data.email_work || session.user.email || null,
        });
      } catch (err) {
        console.error("Failed to fetch employee data:", err);
        setError(err);
        setEmployee(null);
      } finally {
        setLoading(false);
      }
    };

    fetchEmployee();
  }, [session]);

  return { employee, loading, error };
}
