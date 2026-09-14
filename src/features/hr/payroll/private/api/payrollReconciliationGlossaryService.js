// features/hr/payroll/private/api/payrollReconciliationGlossaryService.js
import { supabase } from "../../../../../lib/supabaseClient";

/**
 * Plain lookup-table read, same idiom as attendanceActivitiesMetadataService.js
 * -- payroll_reconciliation_glossary is the single source of truth for the
 * 4 flag explanations, shared with queue_payroll_reconciliation_email_rpc.sql's
 * emailed HTML so the sidebar and the email never drift on wording.
 */
export async function fetchPayrollReconciliationGlossary() {
  const { data, error } = await supabase
    .from("payroll_reconciliation_glossary")
    .select("*")
    .eq("is_active", true);

  if (error) throw error;

  return data || [];
}
