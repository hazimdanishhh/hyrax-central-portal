import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useMessage } from "../../context/MessageContext";
import { useEmployee } from "../../context/EmployeeContext";

export default function useSubordinates({ setMessage } = {}) {
  const { employee } = useEmployee();
  const { showMessage } = useMessage();
  const [subordinates, setSubordinates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchSubordinates() {
      if (!employee?.id) {
        setSubordinates([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("employees_public")
        .select("*")
        .eq("manager_id", employee.id) // 🔥 key logic
        .in("employment_status_name", [
          "Active",
          "Terminated Notice",
          "On Leave",
          "Probation",
        ])
        .order("full_name", { ascending: true });

      if (!isMounted) return;

      if (error) {
        console.error("Failed to fetch subordinates:", error);
        setError(err);
        setSubordinates([]);
        showMessage("Failed to load subordinates", "error");
      } else {
        setSubordinates(data || []);
        showMessage("Subordinates loaded", "success");
      }

      setLoading(false);
    }

    fetchSubordinates();

    return () => {
      isMounted = false;
    };
  }, [employee?.id]);

  return {
    subordinates,
    loading,
    error,
  };
}
