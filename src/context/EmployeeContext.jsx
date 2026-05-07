// context/EmployeeContext.jsx

import { createContext, useContext, useEffect, useState } from "react";

import { supabase } from "../lib/supabaseClient";
import { useAuth } from "./AuthContext";

const EmployeeContext = createContext();

export function EmployeeProvider({ children }) {
  const { session } = useAuth();
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function fetchEmployee() {
    if (!session?.user?.id) {
      setEmployee(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from("employees")
        .select(
          `
          *,
          identification_type:identification_type_id(id,name),
          nationality:nationality_id(id,name),
          department:departments(id,name,sub),
          employment_status:employment_status_id(id,name),
          employment_type:employment_type_id(id,name),
          termination_reason:termination_reason_id (id,name)
        `,
        )
        .eq("profile_id", session.user.id)
        .maybeSingle();

      if (error) throw error;

      setEmployee(data);
    } catch (err) {
      console.error(err);
      setError(err);
      setEmployee(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchEmployee();
  }, [session?.user?.id]);

  return (
    <EmployeeContext.Provider
      value={{
        employee,
        loading,
        error,
        refetchEmployee: fetchEmployee,
      }}
    >
      {children}
    </EmployeeContext.Provider>
  );
}

export function useEmployee() {
  const context = useContext(EmployeeContext);

  if (!context) {
    throw new Error("useEmployee must be used inside EmployeeProvider");
  }

  return context;
}
