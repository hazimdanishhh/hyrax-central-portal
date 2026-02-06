import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function useReportingManager(employeeId, { setMessage } = {}) {
  const [manager, setManager] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!employeeId) {
      setManager(null);
      setLoading(false);
      return;
    }

    const fetchManager = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("employees_public")
        .select(
          `
          manager_id,
          manager_name,
          manager_avatar_url,
          manager_email,
          manager_phone,
          manager_department_name,
          manager_position,
          manager_employee_id,
          manager_preferred_name,
          manager_employment_status_name
        `,
        )
        .eq("employee_id", employeeId)
        .single();

      if (error) {
        console.error(error);
        setMessage?.({
          type: "error",
          text: "Failed to load reporting manager",
        });
        setManager(null);
      } else {
        setManager({
          id: data.manager_id,
          full_name: data.manager_name,
          avatar_url: data.manager_avatar_url,
          email_work: data.manager_email,
          phone_work: data.manager_phone,
          department_name: data.manager_department_name,
          position: data.manager_position,
          employee_id: data.manager_employee_id,
          preferred_name: data.manager_preferred_name,
          employment_status_name: data.manager_employment_status_name,
        });
      }

      setLoading(false);
    };

    fetchManager();
  }, [employeeId]);

  return { manager, loading };
}
