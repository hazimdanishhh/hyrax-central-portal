import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function useEmployeesPublic({ setMessage } = {}) {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function fetchEmployees() {
      setLoading(true);

      // "Active" for directory purposes = the canonical active bucket
      // (Active/Probation/On Leave/Sabbatical) PLUS Terminated Notice --
      // someone serving notice is still physically at work and belongs in a
      // people-picker (see employment_status_category_migration.sql).
      const { data, error } = await supabase
        .from("employees_public")
        .select("*")
        .or(
          "employment_status_category.eq.active,employment_status_name.eq.Terminated Notice",
        )
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
