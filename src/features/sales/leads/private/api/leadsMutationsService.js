import { supabase } from "../../../../../lib/supabaseClient";
import { normalizeFields } from "@/features/_shared/normalizeFields";

/**
 * `account` (tableConfig.jsx) is a synthetic field, not a real sales_leads
 * column -- it tags whichever of a real SAP customer or a native Prospect
 * client a salesperson picked (see leadAccountSearch.js/LeadAccountEditor.jsx).
 * Split it into the two real columns before normalizeFields ever sees it,
 * only when `account` is actually present in the payload (so a partial
 * update that doesn't touch this field never force-nulls either column).
 */
function splitAccountField(rawFields) {
  if (!("account" in rawFields)) return rawFields;

  const { account, ...rest } = rawFields;
  return {
    ...rest,
    client_id: account?.__type === "prospect" ? account.value : null,
    sap_customer_code: account?.__type === "sap" ? account.value : null,
  };
}

/**
 * UPDATE
 */
export async function updateLead(updatedData) {
  const { id, ...rawFields } = updatedData;

  const fields = normalizeFields(splitAccountField(rawFields));

  const { data, error } = await supabase
    .from("sales_leads")
    .update(fields)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;

  return data;
}

/**
 * BULK UPDATE
 */
export async function bulkUpdateLeads(ids, rawFields) {
  const fields = normalizeFields(rawFields);

  const { data, error } = await supabase
    .from("sales_leads")
    .update(fields)
    .in("id", ids)
    .select("*");

  if (error) throw error;
  return data;
}

/**
 * CREATE
 */
export async function createLead(newData) {
  const { id: _id, ...rawFields } = newData;

  const fields = normalizeFields(splitAccountField(rawFields));

  const { data, error } = await supabase
    .from("sales_leads")
    .insert(fields)
    .select("*")
    .single();

  if (error) throw error;

  return data;
}

/**
 * DELETE
 */
export async function deleteLead(id) {
  const { error } = await supabase.from("sales_leads").delete().eq("id", id);

  if (error) throw error;

  return true;
}

/**
 * BULK DELETE
 */
export async function bulkDeleteLeads(ids) {
  const { error } = await supabase.from("sales_leads").delete().in("id", ids);

  if (error) throw error;

  return true;
}
