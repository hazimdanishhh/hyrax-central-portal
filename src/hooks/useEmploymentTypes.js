import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function useEmploymentTypes() {
  const [employmentTypes, setEmploymentTypes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEmploymentTypes = async () => {
      const { data, error } = await supabase
        .from("employment_type")
        .select("id, name, description")
        .order("id");

      if (!error) {
        setEmploymentTypes(data || []);
      }

      setLoading(false);
    };

    fetchEmploymentTypes();
  }, []);

  return {
    employmentTypes,
    loading,
  };
}
