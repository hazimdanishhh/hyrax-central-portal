import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function useITAssetCategory() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCategories = async () => {
      const { data, error } = await supabase
        .from("it_asset_category")
        .select("*")
        .order("name");

      if (!error) {
        setCategories(data || []);
      }

      setLoading(false);
    };

    fetchCategories();
  }, []);

  return {
    categories,
    loading,
  };
}
