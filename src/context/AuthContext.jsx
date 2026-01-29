// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // Create profile safely only for new users
  const createProfileIfNotExists = async (user) => {
    if (!user) return;

    // Check if profile already exists
    const { data: existingProfile, error: fetchError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (fetchError) {
      console.error("Error fetching profile:", fetchError);
      return;
    }

    // Only insert if it doesn't exist
    if (!existingProfile) {
      const { error: insertError } = await supabase.from("profiles").insert({
        id: user.id, // FK to auth.users.id
        // no role_id / department_id here, defaults in table will apply
        updated_at: new Date().toISOString(),
      });

      if (insertError) {
        console.error("Failed to create profile:", insertError);
      }
    }
  };

  useEffect(() => {
    // Initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);

      if (session?.user) {
        createProfileIfNotExists(session.user);
      }
    });

    // Auth listener
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setLoading(false);

        if (session?.user) {
          createProfileIfNotExists(session.user);
        }
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
