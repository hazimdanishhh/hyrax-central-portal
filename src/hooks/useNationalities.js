import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function useNationalities() {
  const [nationalities, setNationalities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNationalities = async () => {
      const { data, error } = await supabase
        .from("nationalities")
        .select("id, name")
        .order("id");

      if (!error) {
        setNationalities(data || []);
      }

      setLoading(false);
    };

    fetchNationalities();
  }, []);

  return {
    nationalities,
    loading,
  };
}
