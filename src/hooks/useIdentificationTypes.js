import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function useIdentificationTypes() {
  const [identificationTypes, setIdentificationTypes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchIdentificationTypes = async () => {
      const { data, error } = await supabase
        .from("identification_type")
        .select("id, name")
        .order("id");

      if (!error) {
        setIdentificationTypes(data || []);
      }

      setLoading(false);
    };

    fetchIdentificationTypes();
  }, []);

  return {
    identificationTypes,
    loading,
  };
}
