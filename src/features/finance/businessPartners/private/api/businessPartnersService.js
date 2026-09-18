import { supabase } from "../../../../../lib/supabaseClient";

/**
 * Read-only Business Partners list, backed directly by the sap_customers
 * mirror table (OCRD) -- the same Business Partner master SAP Clients
 * (sapCustomersService.js) reads, just scoped differently: this is Finance's
 * view, so it defaults to Customer + Vendor ('C'/'S'), not Customer + Lead
 * ('C'/'L') -- a Lead has no AR/AP activity to reconcile, so it's excluded
 * by default and only reachable via the cardType filter's "All" option.
 * SAP is the system of record for this data -- no create/update/delete here.
 */
export async function fetchBusinessPartners({
  page,
  pageSize,
  search,
  filters,
  sortBy,
  sortOrder,
}) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const FILTER_NULL = "__null__";
  const DEFAULT_CARD_TYPES = ["C", "S"];

  let query = supabase
    .from("sap_customers")
    .select("*", { count: "exact" })
    .neq("is_deleted", "Y")
    .order(sortBy, { ascending: sortOrder === "ascending" });

  // --- SEARCH ---
  if (search) {
    query = query.or(
      `customer_name.ilike.%${search}%,customer_code.ilike.%${search}%`,
    );
  }

  // --- CARD TYPE --- defaults to Customer+Vendor unless the cardType filter
  // says otherwise: "All" sends FILTER_NULL (skip the restriction entirely,
  // including Leads), a specific type sends just that one letter.
  let cardTypes = DEFAULT_CARD_TYPES;
  const cardTypeFilter = filters?.cardType;
  if (cardTypeFilter === FILTER_NULL) {
    cardTypes = null;
  } else if (cardTypeFilter) {
    cardTypes = [cardTypeFilter];
  }
  if (cardTypes) query = query.in("card_type", cardTypes);

  // --- FILTERS ---
  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value === undefined || value === "") return;

    switch (key) {
      case "isActive":
        if (value !== FILTER_NULL) query = query.eq("is_active", value);
        break;

      default:
        break; // cardType already resolved above
    }
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

/**
 * Fetch a single Business Partner by code -- fallback for the detail
 * sidebar when the row isn't in the current page's results (e.g. a shared
 * URL). Mirrors sapCustomersService.js's fetchSapCustomerByCode, minus the
 * card_type scoping -- a direct-by-code lookup should resolve regardless of
 * type, including a Lead or Vendor reached via a shared link.
 */
export async function fetchBusinessPartnerByCode(code) {
  if (!code) return null;

  const { data, error } = await supabase
    .from("sap_customers")
    .select("*")
    .eq("customer_code", code)
    .maybeSingle();

  if (error) throw error;

  return data;
}
