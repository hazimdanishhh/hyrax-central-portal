import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function useDepartments() {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDepartments = async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("id, name, sub")
        .order("name");

      if (!error) {
        setDepartments(data || []);
      }

      setLoading(false);
    };

    fetchDepartments();
  }, []);

  return {
    departments,
    loading,
  };
}
