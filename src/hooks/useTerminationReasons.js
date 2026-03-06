import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function useTerminationReasons() {
  const [terminationReasons, setTerminationReasons] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTerminationReasons = async () => {
      const { data, error } = await supabase
        .from("termination_reason")
        .select("id, name, description")
        .order("id");

      if (!error) {
        setTerminationReasons(data || []);
      }

      setLoading(false);
    };

    fetchTerminationReasons();
  }, []);

  return {
    terminationReasons,
    loading,
  };
}
