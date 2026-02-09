import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function useITAssetCondition() {
  const [conditions, setConditions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchConditions = async () => {
      const { data, error } = await supabase
        .from("it_asset_condition")
        .select("*")
        .order("name");

      if (!error) {
        setConditions(data || []);
      }

      setLoading(false);
    };

    fetchConditions();
  }, []);

  return {
    conditions,
    loading,
  };
}
