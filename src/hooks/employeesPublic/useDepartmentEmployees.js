import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useMessage } from "../../context/MessageContext";

/**
 * Hook to fetch the current logged-in user's department employees
 */

export default function useDepartmentEmployees(departmentId) {
  const { showMessage } = useMessage();
  const [departmentEmployees, setDepartmentEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!departmentId) {
      setDepartmentEmployees([]);
      setLoading(false);
      showMessage("No department found", "error");
      console.error("No department found");
      return;
    }

    const fetchEmployees = async () => {
      setLoading(true);
      showMessage("Loading department", "loading");

      const { data, error } = await supabase
        .from("employees_public")
        .select("*")
        .eq("department_id", departmentId)
        .order("full_name");

      if (error) {
        console.error(error);
        showMessage("Failed to load department", "error");
        setError(error);
        setDepartmentEmployees([]);
      } else {
        setDepartmentEmployees(data);
        showMessage("Department loaded", "success");
      }

      setLoading(false);
    };

    fetchEmployees();
  }, [departmentId]);

  return { departmentEmployees, loading, error };
}
