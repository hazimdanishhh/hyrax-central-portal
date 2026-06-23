// features/sales/leads/private/api/leads.js
import { supabase } from "../../../../../lib/supabaseClient";

/**
 * Service to fetch Sales Leads for Sales department
 * Server-side filtering and pagination
 */
export async function fetchLeads({
  page,
  pageSize,
  search,
  filters,
  sortBy,
  sortOrder,
  isExport = false,
}) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const FILTER_NULL = "__null__";

  let query = supabase
    .from("sales_leads")
    .select(
      `
      *,
      client:client_id(*),
      client_contact:client_contact_id(*),
      lead_owner:employees_public!lead_owner_id(*),
      lead_source_type:lead_source_type_id(*),
      lose_reason:lose_reason_id(*)
    `,
      { count: "exact" },
    )
    .order(sortBy, { ascending: sortOrder === "ascending" });

  // --- SEARCH ---
  if (search) {
    query = query.or(`title.ilike.%${search}%`);
  }

  // --- FILTERS ---
  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === "") return;

    // DATE RANGE FILTERS
    if (key === "startDate") {
      query = query.gte("created_at", `${value}T00:00:00`);
    }

    if (key === "endDate") {
      query = query.lte("created_at", `${value}T23:59:59`);
    }

    const map = {
      client: "client_id",
      clientContact: "client_contact_id",
      owner: "lead_owner_id",
      stage: "stage",
      onHold: "is_on_hold",
      cancelled: "is_cancelled",
      leadSourceType: "lead_source_type_id",
      productType: "product_type",
      loseReason: "lose_reason_id",
    };

    const column = map[key];
    if (!column) return;

    // ✅ NULL filter (ONLY for real null)
    if (value === FILTER_NULL) {
      query = query.is(column, null);
      return;
    }

    query = query.eq(column, value);
  });

  // paginate LAST
  // 2. ONLY PAGINATE IF IT IS NOT AN EXPORT
  if (!isExport) {
    query = query.range(from, to);
  }

  const { data, count, error } = await query;

  if (error) throw error;

  return {
    data: normalizeLeads(data || []),
    totalCount: count || 0,
  };
}

/**
 * Normalize returned data
 */
function normalizeLeads(rows) {
  return rows.map((activity) => ({
    ...activity,

    created_at: formatDateTime(activity.created_at),
    updated_at: formatDateTime(activity.updated_at),

    created_date: formatDate(activity.created_at),
    created_time: formatTime(activity.created_at),

    updated_date: formatDate(activity.updated_at),
    updated_time: formatTime(activity.updated_at),
  }));
}

function formatDateTime(value) {
  if (!value) return null;

  return new Date(value).toLocaleString("en-MY", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatDate(value) {
  if (!value) return null;

  return new Date(value).toLocaleDateString("en-MY", {
    dateStyle: "medium",
  });
}

function formatTime(value) {
  if (!value) return null;

  return new Date(value).toLocaleTimeString("en-MY", {
    timeStyle: "short",
  });
}
