import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import useEmployee from "./useEmployee";

export default function useSubordinates({ setMessage } = {}) {
  const { employee } = useEmployee();

  const [subordinates, setSubordinates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function fetchSubordinates() {
      if (!employee?.id) {
        setSubordinates([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      const { data, error } = await supabase
        .from("employees_public")
        .select("*")
        .eq("manager_id", employee.id) // 🔥 key logic
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
        console.error("Failed to fetch subordinates:", error);
        setSubordinates([]);
        setMessage?.("Failed to load subordinates", "error");
      } else {
        setSubordinates(data || []);
        setMessage?.("Subordinates loaded", "success");
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
  };
}
