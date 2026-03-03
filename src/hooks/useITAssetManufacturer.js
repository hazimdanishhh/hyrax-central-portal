import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function useITAssetManufacturer() {
  const [manufacturers, setManufacturers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchConditions = async () => {
      const { data, error } = await supabase
        .from("it_asset_manufacturer")
        .select("*")
        .order("name");

      if (!error) {
        setManufacturers(data || []);
      }

      setLoading(false);
    };

    fetchConditions();
  }, []);

  return {
    manufacturers,
    loading,
  };
}
