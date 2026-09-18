import { useQuery } from "@tanstack/react-query";
import { getEmployeeById } from "../api/employeeSearch";

// Resolves a lead_owner_id -> {label, value} even when this rep+year has
// zero existing sales_targets rows (e.g. straight off "Add Target"), since
// useAllSalesTargets' row-embedded `employee.full_name` only exists on rows
// that already exist. Wraps the already-existing getEmployeeById -- no new
// Supabase query logic.
export function useEmployeeOption(employeeId) {
  return useQuery({
    queryKey: ["employeeOption", employeeId],
    queryFn: () => getEmployeeById(employeeId),
    enabled: !!employeeId,
    staleTime: 1000 * 60 * 10,
  });
}
