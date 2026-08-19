// Service for the HR Leave Management page (src/pages/user/hr/leaveManagement/).
// Read-only: leave_ledger_entries is populated exclusively by
// sync_leave_ledger_from_snapshot (see leaveImportService.js) -- HR2000
// remains the system of record, so this page never writes rows directly.
import { supabase } from "@/lib/supabaseClient";

export async function fetchLeaveRecords({
  page,
  pageSize,
  search,
  filters,
  sortBy,
  sortOrder,
}) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const f = filters || {};

  let query = supabase
    .from("leave_ledger_entries")
    .select(
      `
        id,
        employee_id,
        employee_code,
        leave_date,
        leave_type_id,
        leave_type_code,
        day_fraction,
        remarks,
        last_seen_at,
        employee:employee_id (id, full_name),
        leave_type:leave_type_id (id, code, label, category)
      `,
      { count: "exact" },
    )
    .order(sortBy, { ascending: sortOrder === "ascending" });

  // employee_code/remarks live directly on this table (denormalized at sync
  // time), so search doesn't need an embedded-resource filter.
  if (search) {
    query = query.or(
      `employee_code.ilike.%${search}%,remarks.ilike.%${search}%`,
    );
  }

  if (f.leaveType) query = query.eq("leave_type_id", f.leaveType);
  if (f.startDate) query = query.gte("leave_date", f.startDate);
  if (f.endDate) query = query.lte("leave_date", f.endDate);

  query = query.range(from, to);

  const { data, count, error } = await query;

  if (error) throw error;

  return {
    data: data || [],
    totalCount: count || 0,
  };
}

export async function fetchLeaveLedgerTypes() {
  const { data, error } = await supabase
    .from("leave_ledger_types")
    .select("id, code, label, category")
    .eq("is_active", true)
    .order("code", { ascending: true });

  if (error) throw error;

  return data || [];
}
