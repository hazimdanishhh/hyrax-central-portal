import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function useITAssetSubcategory() {
  const [subcategories, setSubcategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSubcategories = async () => {
      const { data, error } = await supabase
        .from("it_asset_subcategory")
        .select("*")
        .order("name");

      if (!error) {
        setSubcategories(data || []);
      }

      setLoading(false);
    };

    fetchSubcategories();
  }, []);

  return {
    subcategories,
    loading,
  };
}
