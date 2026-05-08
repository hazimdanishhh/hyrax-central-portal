// services/useEmployee.js

import { supabase } from "../../../../../lib/supabaseClient";

/**
 * Service to fetch all ACTIVE Public Employees
 * Server-side filtering and pagination
 */
export async function fetchEmployeesPublic({
  page,
  pageSize,
  search,
  filters,
  sortBy,
  sortOrder,
}) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("employees_public")
    .select(`*`, { count: "exact" })
    .in("employment_status_name", ["Active", "Probation", "Terminated Notice"])
    .order(sortBy, { ascending: sortOrder === "ascending" });

  // --- SEARCH ---
  if (search) {
    query = query.or(
      `employee_id.ilike.%${search}%,full_name.ilike.%${search}%`,
    );
  }

  // --- FILTERS ---
  Object.entries(filters).forEach(([key, value]) => {
    if (!value) return;

    const map = {
      department: "department_id",
      employmentType: "employment_type_id",
      nationality: "nationality_id",
      manager: "manager_id",
    };

    if (map[key]) query = query.eq(map[key], value);
  });

  // paginate LAST
  query = query.range(from, to);

  const { data, count, error } = await query;

  if (error) throw error;

  return {
    data: data || [],
    totalCount: count || 0,
  };
}
