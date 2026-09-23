// Service for the HR Leave Management > Leave Types tab.
//
// leave_ledger_types is the vocabulary the leave sync resolves codes against.
// It is NOT synced data: HR2000 supplies leave ENTRIES, and this table holds
// two fields HR2000 never sends -- `is_paid` and `needs_hr_confirmation`.
//
// That distinction is the whole reason this service can write at all, while
// leaveRecordsService.js is strictly read-only. Editing an ENTRY would be
// discarded by the next full-snapshot sync; editing a TYPE persists, because
// the sync only ever looks types up by `code` and creates ones it has not
// seen.
import { supabase } from "@/lib/supabaseClient";

// `notes` is included deliberately. Every seeded type carries its own
// rationale there -- "Genuinely ambiguous guess", "coin-flip guess",
// "is_paid=false has real payroll consequences if wrong" -- which is precisely
// the context someone needs while deciding whether needs_hr_confirmation can
// be cleared. Leaving it out would have made the review queue a form with no
// evidence in it.
const COLUMNS =
  "id, code, label, category, is_paid, needs_hr_confirmation, notes, is_active";

/**
 * Every type, including inactive ones -- unlike fetchLeaveLedgerTypes in
 * leaveRecordsService.js, which filters to is_active for use as a picker.
 * This is the management view: HR has to be able to see and reactivate
 * something they retired.
 *
 * Ordered so anything the sync auto-created and flagged floats to the top.
 * That ordering is what turns this tab into a review queue rather than a flat
 * lookup list, and it is what makes the sync's "default to paid" safe -- an
 * unclassified type is the first thing HR sees here.
 */
export async function fetchAllLeaveTypes() {
  const { data, error } = await supabase
    .from("leave_ledger_types")
    .select(COLUMNS)
    .order("needs_hr_confirmation", { ascending: false })
    .order("code", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createLeaveType(newData) {
  const { id: _id, ...fields } = newData;

  const { data, error } = await supabase
    .from("leave_ledger_types")
    .insert(fields)
    .select(COLUMNS)
    .single();

  if (error) throw error;
  return data;
}

/**
 * `code` is deliberately stripped before the update.
 *
 * It is the key the sync matches on (`lt.code = v.leave_type_raw`), so
 * renaming it would orphan every entry that used the old spelling AND make
 * the next sync auto-create the original code again as a second, unclassified
 * type. The column is editable only at creation time; the UI enforces the same
 * rule, and this is the backstop.
 */
export async function updateLeaveType(updatedData) {
  const { id, code: _code, ...fields } = updatedData;

  const { data, error } = await supabase
    .from("leave_ledger_types")
    .update(fields)
    .eq("id", id)
    .select(COLUMNS)
    .single();

  if (error) throw error;
  return data;
}
