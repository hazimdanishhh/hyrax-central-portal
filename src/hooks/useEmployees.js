// src/hooks/useEmployee.js
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useMessage } from "../context/MessageContext";

/**
 * Hook to fetch all employee records from employees table
 * This is private HR / employment data
 * Server-side filtering and pagination
 */
export default function useEmployees({ pageSize = 20, ready = true } = {}) {
  const { showMessage } = useMessage();
  const [employees, setEmployees] = useState([]); // Employees Data Array
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalCount, setTotalCount] = useState(0); // Filtered Data Length
  const [page, setPage] = useState(1); // Current Page Number
  const [search, setSearch] = useState(""); // Current Search
  const [filters, setFilters] = useState({}); // Current Filters
  const [summary, setSummary] = useState({});

  // =============
  // FETCH EMPLOYEES
  // =============
  const fetchEmployees = async ({
    page = 1,
    search = "",
    filters = {},
  } = {}) => {
    setLoading(true);
    setError(null);
    // showMessage(" ", "loading");

    try {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from("employees")
        .select(
          `
            *,
            profile:profile_id (*),
            identification_type:identification_type_id (id,name),
            nationality:nationality_id (id,name),
            department:departments (id,name,sub),
            manager:manager_id (id,employee_id,full_name,preferred_name,email_work,phone_work,position,
              department:departments (id,name,sub)),
            employment_status:employment_status_id (id,name),
            employment_type:employment_type_id (id,name),
            termination_reason:termination_reason_id (id,name
            )
          `,
          { count: "exact" },
        )
        .order("full_name", { ascending: true });

      // --- SEARCH ---
      if (search) {
        query = query.or(
          `employee_id.ilike.%${search}%,full_name.ilike.%${search}%`,
        );
      }

      // --- FILTERS ---
      Object.entries(filters).forEach(([key, value]) => {
        if (!value) return;

        switch (key) {
          case "department":
            query = query.eq("department_id", value);
            break;
          case "employmentStatus":
            query = query.eq("employment_status_id", value);
            break;
          case "employmentType":
            query = query.eq("employment_type_id", value);
            break;
          case "terminationReason":
            query = query.eq("termination_reason_id", value);
            break;
          case "nationality":
            query = query.eq("nationality_id", value);
            break;
          case "identificationType":
            query = query.eq("identification_type_id", value);
            break;
          case "maritalStatus":
            query = query.eq("marital_status", value);
            break;
          default:
            break;
        }
      });

      // paginate LAST
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      setEmployees(data || []);
      setTotalCount(count || 0);
      // showMessage(null, "success");
    } catch (err) {
      setError(err);
      setEmployees([]);
      setTotalCount(0);
      showMessage("Failed to load employees", "error");
    } finally {
      setLoading(false);
    }
  };

  // =============
  // SUMMARY EMPLOYEES
  // =============
  const fetchEmployeeSummary = async () => {
    try {
      const { data: statuses } = await supabase
        .from("employment_status")
        .select("id, name");

      const getIds = (names) =>
        statuses.filter((s) => names.includes(s.name)).map((s) => s.id);

      const activeIds = getIds([
        "Active",
        "Intern",
        "Probation",
        "Contract",
        "Freelance",
        "Terminated Notice",
      ]);

      const inactiveIds = getIds([
        "Terminated",
        "Resigned",
        "Retired",
        "Inactive",
        "Suspended",
        "Sabbatical",
        "On Leave",
      ]);

      const { count: total } = await supabase
        .from("employees")
        .select("id", { count: "exact" });

      const { count: active } = await supabase
        .from("employees")
        .select("id", { count: "exact" })
        .in("employment_status_id", activeIds);

      const { count: inactive } = await supabase
        .from("employees")
        .select("id", { count: "exact" })
        .in("employment_status_id", inactiveIds);

      const { count: probation } = await supabase
        .from("employees")
        .select("id", { count: "exact" })
        .in("employment_status_id", getIds(["Probation"]));

      const { count: interns } = await supabase
        .from("employees")
        .select("id", { count: "exact" })
        .in("employment_status_id", getIds(["Intern"]));

      const thirtyDaysAgo = new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1000,
      ).toISOString();

      const { count: newHires30Days } = await supabase
        .from("employees")
        .select("id", { count: "exact" })
        .gte("join_date", thirtyDaysAgo);

      setSummary({
        total: total || 0,
        active: active || 0,
        inactive: inactive || 0,
        probation: probation || 0,
        interns: interns || 0,
        newHires30Days: newHires30Days || 0,
      });
    } catch (err) {
      console.error("Failed to fetch employee summary", err);
    }
  };

  useEffect(() => {
    if (!ready) return;

    fetchEmployeeSummary();
  }, [ready]);

  useEffect(() => {
    if (!ready) return;

    fetchEmployees({ page, search, filters });
  }, [page, search, filters, ready]);

  // =============
  // REFETCH ALL
  // =============
  const refetchAll = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchEmployees({ page, search, filters }),
        fetchEmployeeSummary(),
      ]);
    } finally {
      setLoading(false);
    }
  };

  return {
    employees,
    loading,
    error,
    totalCount,
    page,
    setPage,
    search,
    setSearch,
    filters,
    setFilters,
    refetch: refetchAll,
    summary,
  };
}
