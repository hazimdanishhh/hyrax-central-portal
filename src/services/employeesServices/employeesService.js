// src/hooks/useEmployee.js
import { supabase } from "../../lib/supabaseClient";

/**
 * Hook to fetch all employee records from employees table
 * This is private HR / employment data
 * Server-side filtering and pagination
 */
export async function fetchEmployees({
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
      employmentStatus: "employment_status_id",
      employmentType: "employment_type_id",
      terminationReason: "termination_reason_id",
      nationality: "nationality_id",
      identificationType: "identification_type_id",
      maritalStatus: "marital_status",
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
