import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function useITAssetStatus() {
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatuses = async () => {
      const { data, error } = await supabase
        .from("it_asset_status")
        .select("*")
        .order("name");

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
