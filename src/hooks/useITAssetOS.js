import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function useITAssetOS() {
  const [operatingSystems, setOperatingSystems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOS = async () => {
      const { data, error } = await supabase
        .from("it_asset_operating_system")
        .select("*")
        .order("name");

      if (!error) {
        setOperatingSystems(data || []);
      }

      setLoading(false);
    };

    fetchOS();
  }, []);

  return {
    operatingSystems,
    loading,
  };
}
