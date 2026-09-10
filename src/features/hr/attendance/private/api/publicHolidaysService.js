// features/hr/attendance/private/api/publicHolidaysService.js
import { supabase } from "../../../../../lib/supabaseClient";
import { normalizeFields } from "@/features/_shared/normalizeFields";

/**
 * public_holidays is small (a year's calendar, ~30 rows) and HR-managed --
 * fetched in full, ordered by date, no server-side pagination needed.
 */
export async function fetchPublicHolidays() {
  const { data, error } = await supabase
    .from("public_holidays")
    .select("*, work_location:work_locations(id, name)")
    .order("holiday_date");

  if (error) throw error;

  return data || [];
}

export async function createPublicHoliday(newData) {
  const { id: _id, work_location: _workLocation, ...rawFields } = newData;

  const fields = normalizeFields(rawFields);

  const { data, error } = await supabase
    .from("public_holidays")
    .insert(fields)
    .select("*, work_location:work_locations(id, name)")
    .single();

  if (error) throw error;

  return data;
}

export async function updatePublicHoliday(updatedData) {
  const { id, work_location: _workLocation, ...rawFields } = updatedData;

  const fields = normalizeFields(rawFields);

  const { data, error } = await supabase
    .from("public_holidays")
    .update(fields)
    .eq("id", id)
    .select("*, work_location:work_locations(id, name)")
    .single();

  if (error) throw error;

  return data;
}

export async function deletePublicHoliday(id) {
  const { error } = await supabase.from("public_holidays").delete().eq("id", id);

  if (error) throw error;

  return true;
}
