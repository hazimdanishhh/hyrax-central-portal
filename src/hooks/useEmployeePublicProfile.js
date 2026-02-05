// src/hooks/useEmployeePublicProfile.js
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function useEmployeePublicProfile(profileId) {
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!profileId) {
      setEmployee(null);
      setLoading(false);
      return;
    }

    const fetchEmployee = async () => {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("employees_public")
        .select("*")
        .eq("profile_id", profileId)
        .single();

      if (error) {
        console.error(error);
        setEmployee(null);
        setError(error);
      } else {
        setEmployee(data);
      }

      setLoading(false);
    };

    fetchEmployee();
  }, [profileId]);

  return { employee, loading, error };
}
