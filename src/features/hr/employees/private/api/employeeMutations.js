import { supabase } from "../../../../../lib/supabaseClient";
import { normalizeFields } from "@/features/_shared/normalizeFields";

const PERSONAL_ADDRESS_FIELD_KEYS = [
  "personal_address_line1",
  "personal_address_line2",
  "personal_address_city",
  "personal_address_state",
  "personal_address_postcode",
  "personal_address_country",
];

/**
 * `personal_address_line1..country` (tableConfig.jsx) are flat form
 * columns, not real `employees` columns -- see
 * docs/WORK-LOCATIONS-ARCHITECTURE.md. Unlike leadsMutationsService.js's
 * splitAccountField (a synchronous remap of an already-resolved value),
 * this performs a real upsert: every employee always creates-or-updates
 * their own single linked `addresses` row, there's no "pick an existing
 * one" step. No-ops (returns rawFields unchanged) when none of the 6 keys
 * are present, so a partial update that doesn't touch the address never
 * force-nulls it.
 */
async function resolvePersonalAddressFields(rawFields, existingAddressId) {
  const hasAddressFields = PERSONAL_ADDRESS_FIELD_KEYS.some(
    (key) => key in rawFields,
  );
  if (!hasAddressFields) return rawFields;

  const {
    personal_address_line1: line1,
    personal_address_line2: line2,
    personal_address_city: city,
    personal_address_state: state,
    personal_address_postcode: postcode,
    personal_address_country: country,
    ...rest
  } = rawFields;

  const addressPayload = { line1, line2, city, state, postcode, country };
  const isBlank = Object.values(addressPayload).every((v) => !v);

  // Every field cleared -- unlink rather than leave/create an empty row.
  if (isBlank) {
    return { ...rest, personal_address_id: null };
  }

  if (existingAddressId) {
    const { error } = await supabase
      .from("addresses")
      .update(addressPayload)
      .eq("id", existingAddressId);

    if (error) throw error;

    return { ...rest, personal_address_id: existingAddressId };
  }

  const { data, error } = await supabase
    .from("addresses")
    .insert(addressPayload)
    .select("id")
    .single();

  if (error) throw error;

  return { ...rest, personal_address_id: data.id };
}

/**
 * UPDATE
 */
export async function updateEmployee(updatedData) {
  const { id, ...rawFields } = updatedData;

  const { data: current } = await supabase
    .from("employees")
    .select("personal_address_id")
    .eq("id", id)
    .single();

  const resolvedFields = await resolvePersonalAddressFields(
    rawFields,
    current?.personal_address_id,
  );
  const fields = normalizeFields(resolvedFields);

  const { data, error } = await supabase
    .from("employees")
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
export async function bulkUpdateEmployees(ids, rawFields) {
  const fields = normalizeFields(rawFields);

  const { data, error } = await supabase
    .from("employees")
    .update(fields)
    .in("id", ids)
    .select("*");

  if (error) throw error;
  return data;
}

/**
 * CREATE
 */
export async function createEmployee(newData) {
  const { id: _id, ...rawFields } = newData;

  // A new employee never has an existing linked address to update.
  const resolvedFields = await resolvePersonalAddressFields(rawFields, null);
  const fields = normalizeFields(resolvedFields);

  const { data, error } = await supabase
    .from("employees")
    .insert(fields)
    .select("*")
    .single();

  if (error) throw error;

  return data;
}

/**
 * DELETE
 */
export async function deleteEmployee(id) {
  const { error } = await supabase.from("employees").delete().eq("id", id);

  if (error) throw error;

  return true;
}

/**
 * BULK DELETE
 */
export async function bulkDeleteEmployees(ids) {
  const { error } = await supabase.from("employees").delete().in("id", ids);

  if (error) throw error;

  return true;
}
