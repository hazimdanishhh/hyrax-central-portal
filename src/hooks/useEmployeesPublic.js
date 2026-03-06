import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function useEmployeesPublic({ setMessage } = {}) {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function fetchEmployees() {
      setLoading(true);

      const { data, error } = await supabase
        .from("employees_public")
        .select("*")
        .in("employment_status_name", [
          "Active",
          "Intern",
          "Probation",
          "Contract",
          "Freelance",
          "Terminated Notice",
        ])
        .order("full_name", { ascending: true });

      if (!isMounted) return;

      if (error) {
        console.error("Failed to fetch employees:", error);
        setEmployees([]);
      } else {
        setEmployees(data || []);
      }

      setLoading(false);
    }

    fetchEmployees();

    return () => {
      isMounted = false;
    };
  }, [setMessage]);

  return {
    employees,
    loading,
  };
}
