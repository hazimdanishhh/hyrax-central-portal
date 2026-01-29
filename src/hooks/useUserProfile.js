// src/hooks/useUserProfile.jsx
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";

/**
 * Hook to fetch the current logged-in user's profile
 * Includes role and department names
 */
export default function useUserProfile() {
  const { session } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!session?.user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const fetchProfile = async () => {
      setLoading(true);
      setError(null);

      try {
        // Supabase query: profiles -> join roles and departments
        const { data, error: fetchError } = await supabase
          .from("profiles")
          .select(
            `
            id,
            created_at,
            updated_at,
            role:roles(name),
            department:departments(sub, name)
          `,
          )
          .eq("id", session.user.id) // RLS: will only fetch their own profile
          .single();

        if (fetchError) throw fetchError;

        setProfile({
          ...data,
          role: data?.role?.name || null,
          department: data?.department?.name || null,
          departmentSub: data?.department?.sub || null,
        });
      } catch (err) {
        console.error("Failed to fetch user profile:", err);
        setError(err);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [session]);

  return { profile, loading, error };
}
