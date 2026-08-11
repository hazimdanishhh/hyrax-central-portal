import { supabase } from "../../../../../lib/supabaseClient";

// Deliberately a small, self-contained duplicate of the same shape of query
// in financeMetadataService.js/salesOrdersMetadataService.js, per this
// codebase's existing "one copy per domain" convention -- but with a
// materially different SELECT: those two only need customer_code/
// customer_name for a filter chip; this one needs enough columns to
// disambiguate customers that share the exact same name (confirmed live:
// one company can span 70+ SAP customer_codes, branch-driven -- see
// hyrax-data-platform/docs/data-dictionary.md's sap_customers section and
// hyrax-central-portal/docs/DASHBOARD-ROADMAP.md §1.4). Search matches
// customer_name OR customer_code, since a salesperson who already knows the
// code should be able to jump straight to it instead of hoping the name
// search surfaces the right one of 70+ near-identical rows.
//
// card_type: 'C' = customer, 'L' = lead, 'S' = supplier (see
// data-dictionary.md). Filtered to C/L, not just C -- SAP's own 'L' rows are
// presumably pre-transaction parties too, the same class of "not yet a real
// customer" this feature exists to handle; whether Hyrax's live data
// actually has any 'L' rows worth surfacing is unconfirmed (no live SAP
// access to check), but including them costs nothing if the set is empty.
// is_deleted='Y' rows are excluded -- not real, linkable customers.
export async function searchSapCustomersForLinking(search = "") {
  let query = supabase
    .from("sap_customers")
    .select("customer_code, customer_name, city, contact_person, phone")
    .in("card_type", ["C", "L"])
    .neq("is_deleted", "Y")
    .order("customer_name")
    .limit(20);

  if (search?.trim()) {
    query = query.or(
      `customer_name.ilike.%${search}%,customer_code.ilike.%${search}%`,
    );
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data || []).map((customer) => ({
    value: customer.customer_code,
    label: customer.customer_name,
    // Disambiguating detail for the custom option renderer -- see
    // SapCustomerOption.jsx. Plain react-select consumers (filter bars
    // elsewhere) just ignore these extra keys.
    city: customer.city,
    contactPerson: customer.contact_person,
    phone: customer.phone,
  }));
}

export async function getSapCustomerByCode(code) {
  if (!code) return null;

  const { data, error } = await supabase
    .from("sap_customers")
    .select("customer_code, customer_name, city, contact_person, phone")
    .eq("customer_code", code)
    .single();

  if (error || !data) return null;

  return {
    value: data.customer_code,
    label: data.customer_name,
    city: data.city,
    contactPerson: data.contact_person,
    phone: data.phone,
  };
}
