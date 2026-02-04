// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  /**
   * Sync Google metadata into profiles table on first login
   * Does NOT overwrite role_id or department_id
   */
  const syncProfile = async (user) => {
    if (!user) return;

    // 1️⃣ Check if profile already exists
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", user.id)
      .maybeSingle();

    const avatarAlreadySet =
      existingProfile?.avatar_url &&
      !existingProfile.avatar_url.includes("googleusercontent.com");

    // 2️⃣ Upsert WITHOUT touching avatar_url if it already exists
    const { error } = await supabase.from("profiles").upsert(
      {
        id: user.id,
        full_name: user.user_metadata?.full_name || null,
        email: user.email,
        avatar_url: avatarAlreadySet
          ? existingProfile.avatar_url
          : "/profilePhoto/default.webp",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );

    if (error) console.error("Profile sync failed:", error);
  };

  useEffect(() => {
    // Initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (session?.user) syncProfile(session.user);
    });

    // Auth listener
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setLoading(false);
        if (session?.user) syncProfile(session.user);
      },
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  // Logout
  const logout = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ session, loading, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
