import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";

/**
 * Hook to fetch all user profiles
 * Intended for System Superadmin users page
 */
export default function useUserProfiles() {
  const { session } = useAuth();

  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!session?.user) {
      setProfiles([]);
      setLoading(false);
      return;
    }

    const fetchProfiles = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: fetchError } = await supabase
          .from("profiles")
          .select(
            `
            id,
            full_name,
            email,
            avatar_url,
            created_at,
            updated_at,
            role_id,
            department_id,
            roles(name),
            departments(sub, name)
          `,
          )
          .order("created_at", { ascending: false });

        if (fetchError) throw fetchError;

        const mappedProfiles =
          data?.map((profile) => ({
            id: profile.id,
            created_at: profile.created_at,
            updated_at: profile.updated_at,
            role_id: profile.role_id,
            department_id: profile.department_id,
            role: profile.roles?.name || null,
            department: profile.departments?.name || null,
            departmentSub: profile.departments?.sub || null,
            full_name: profile.full_name || null,
            email: profile.email || null,
            avatar_url: profile.avatar_url || "/profilePhoto/default.webp",
          })) || [];

        setProfiles(mappedProfiles);
      } catch (err) {
        console.error("Failed to fetch user profiles:", err);
        setError(err);
        setProfiles([]);
      } finally {
        setLoading(false);
      }
    };

    fetchProfiles();
  }, [session]);

  return { profiles, loading, error };
}
