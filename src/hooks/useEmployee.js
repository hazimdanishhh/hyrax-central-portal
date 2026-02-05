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
            id,
            profile_id,

            employee_id,
            full_name,
            preferred_name,
            date_of_birth,
            gender,
            nationality,
            identification_type,
            identification_number,
            marital_status,

            email_personal,
            email_work,
            phone_personal,
            phone_work,
            emergency_contact_name,
            emergency_contact_relationship,
            emergency_contact_phone,

            department:departments (
            id,
            name,
            sub
            ),

            position,

            manager:employees_manager_id_fkey (
              id,
              full_name,
              email,
              avatar_url,
              department:departments (
                id,
                name,
                sub
              )
            )
              
            employment_status,
            employment_type,
            join_date,
            confirmation_date,
            end_date,
            resignation_date,
            termination_reason,

            address_personal,
            address_work,

            created_at,
            updated_at
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
