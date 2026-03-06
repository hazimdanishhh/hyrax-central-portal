// src/hooks/useProfiles.js
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";

/**
 * Hook to fetch all employee records
 * This is private HR / employment data
 */
export default function useProfiles() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProfiles = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select(
            `
            *,
            role:role_id (
              id,
              name
            ),
            department:department_id (
              id,
              name,
              sub
            )
          `,
          )
          .order("full_name", { ascending: true });

        if (error) throw error;

        if (!data) {
          setProfiles([]);
          return;
        }

        setProfiles(data || []);
      } catch (err) {
        console.error("Failed to fetch profiles data:", err);
        setError(err);
        setProfiles([]);
      } finally {
        setLoading(false);
      }
    };

    fetchProfiles();
  }, []);

  return { profiles, loading, error };
}
