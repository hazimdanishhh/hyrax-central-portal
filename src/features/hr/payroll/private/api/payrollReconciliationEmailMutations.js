// features/hr/payroll/private/api/payrollReconciliationEmailMutations.js
import { supabase } from "../../../../../lib/supabaseClient";

/**
 * Queues one reconciliation email for one employee's one period onto the
 * existing email_queue/send-queued-emails pipeline
 * (queue_payroll_reconciliation_email_rpc.sql). Async -- the RPC inserts
 * into email_queue and returns immediately; the already-deployed
 * send-queued-emails Edge Function (pg_cron, every 5 min) does the actual
 * send. Not "sent" the moment this resolves -- "queued".
 */
export async function queuePayrollReconciliationEmail({
  employeeUuid,
  startDate,
  endDate,
}) {
  const { data, error } = await supabase.rpc(
    "queue_payroll_reconciliation_email",
    {
      p_employee_uuid: employeeUuid,
      p_start_date: startDate,
      p_end_date: endDate,
    },
  );

  if (error) throw error;

  return data;
}
