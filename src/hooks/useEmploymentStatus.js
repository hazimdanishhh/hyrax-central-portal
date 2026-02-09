import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function useEmploymentStatus() {
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatuses = async () => {
      const { data, error } = await supabase
        .from("employment_status")
        .select("id, name, description")
        .order("id");

      if (!error) {
        setStatuses(data || []);
      }

      setLoading(false);
    };

    fetchStatuses();
  }, []);

  return {
    statuses,
    loading,
  };
}
