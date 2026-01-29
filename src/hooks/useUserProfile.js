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
        // 1️⃣ Fetch profile row from profiles table
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select(
            `
            id,
            created_at,
            updated_at,
            role_id,
            department_id,
            roles(name),
            departments(sub, name)
          `,
          )
          .eq("id", session.user.id)
          .maybeSingle();

        if (profileError) throw profileError;

        if (!profileData) {
          setProfile(null);
          return;
        }

        // 2️⃣ Map the data for frontend
        setProfile({
          id: profileData.id,
          created_at: profileData.created_at,
          updated_at: profileData.updated_at,
          role_id: profileData.role_id,
          department_id: profileData.department_id,
          role: profileData.roles?.name || null,
          department: profileData.departments?.name || null,
          departmentSub: profileData.departments?.sub || null,
          // You can add other Google Workspace metadata here if you sync it
          full_name: session.user.user_metadata?.full_name || null,
          email: session.user.email,
          avatar_url:
            session.user.user_metadata?.avatar_url ||
            "/profilePhoto/default.webp",
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
