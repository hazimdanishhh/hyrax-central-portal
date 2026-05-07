// context/ProfileContext.jsx

import { createContext, useContext, useEffect, useState } from "react";

import { supabase } from "../lib/supabaseClient";
import { useAuth } from "./AuthContext";

const ProfileContext = createContext();

export function ProfileProvider({ children }) {
  const { session } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function fetchProfile() {
    if (!session?.user?.id) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("profiles")
      .select(
        `
        *,
        role:role_id (id,name),
        department:department_id (id,name,sub)
      `,
      )
      .eq("id", session.user.id)
      .maybeSingle();

    if (error) {
      console.error(error);
      setError(err);
      setProfile(null);
    } else {
      setProfile(data);
    }

    setLoading(false);
  }

  useEffect(() => {
    fetchProfile();
  }, [session?.user?.id]);

  //   SYSTEM ROLES FROM ROLES TABLE
  const role = profile?.role?.name;

  const isSuperAdmin = role === "superadmin";
  const isManager = role === "manager";
  const isStaff = role === "staff";

  return (
    <ProfileContext.Provider
      value={{
        profile,
        loading,
        role,
        error,
        isSuperAdmin,
        isManager,
        isStaff,

        refetchProfile: fetchProfile,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);

  if (!context) {
    throw new Error("useProfile must be used inside ProfileProvider");
  }

  return context;
}
