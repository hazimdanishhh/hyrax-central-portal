import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function useEmployees({ setMessage } = {}) {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function fetchEmployees() {
      setLoading(true);

      const { data, error } = await supabase
        .from("employees_public")
        .select("*")
        .order("full_name", { ascending: true });

      if (!isMounted) return;

      if (error) {
        console.error("Failed to fetch employees:", error);
        setEmployees([]);

        if (setMessage) {
          setMessage({
            text: "Failed to load employees.",
            type: "error",
          });
        }
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
