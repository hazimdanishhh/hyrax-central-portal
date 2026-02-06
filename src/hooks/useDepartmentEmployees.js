import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

/**
 * Hook to fetch the current logged-in user's department employees
 */

export default function useDepartmentEmployees(
  departmentId,
  { setMessage } = {},
) {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!departmentId) {
      setEmployees([]);
      setLoading(false);
      return;
    }

    const fetchEmployees = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("employees_public")
        .select("*")
        .eq("department_id", departmentId)
        .order("full_name");

      if (error) {
        console.error(error);
        setMessage?.({
          type: "error",
          text: "Failed to load department employees",
        });
        setEmployees([]);
      } else {
        setEmployees(data);
      }

      setLoading(false);
    };

    fetchEmployees();
  }, [departmentId]);

  return { employees, loading };
}
