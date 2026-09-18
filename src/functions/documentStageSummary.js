/**
 * Shared "current stage" classifier for a document carrying
 * outstanding_balance/due_date/has_paid_mismatch (sap_invoices_with_balance,
 * sap_vendor_bills_with_balance -- see finance_outstanding_balance_views.sql).
 * Mirrors SalesOrderFulfillmentStage.jsx's getFulfillmentStageSummary() in
 * spirit -- one function, computed entirely from fields the view already
 * returns, collapsing status/outstanding/due-date/mismatch into one badge
 * instead of several small facts a user has to mentally combine.
 *
 * Plain string date comparison (matches invoicesService.js/billsService.js's
 * own overdueOnly/dueSoonOnly/criticallyOverdueOnly filter cutoffs exactly)
 * -- these `date` columns round-trip as bare "YYYY-MM-DD" strings with no
 * time component, so string comparison sidesteps local-timezone-vs-UTC-
 * midnight drift a Date-object parse could introduce.
 */
const DUE_SOON_WINDOW_DAYS = 7;
const CRITICALLY_OVERDUE_DAYS = 90;

export function getDocumentStageSummary({
  isCancelled,
  outstanding,
  dueDate,
  hasPaidMismatch,
}) {
  if (isCancelled) {
    return { stage: "Cancelled", tone: "red" };
  }

  if ((outstanding ?? 0) <= 0.01) {
    return hasPaidMismatch
      ? { stage: "Paid (Verify)", tone: "yellow" }
      : { stage: "Paid", tone: "green" };
  }

  if (!dueDate) {
    return { stage: "Open", tone: "blue" };
  }

  const today = new Date().toISOString().split("T")[0];
  const dueSoonCutoff = new Date(
    Date.now() + DUE_SOON_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  )
    .toISOString()
    .split("T")[0];
  const criticallyOverdueCutoff = new Date(
    Date.now() - CRITICALLY_OVERDUE_DAYS * 24 * 60 * 60 * 1000,
  )
    .toISOString()
    .split("T")[0];
  const due = String(dueDate).split("T")[0];

  if (due < criticallyOverdueCutoff) {
    return { stage: "Critically Overdue", tone: "red" };
  }
  if (due < today) {
    return { stage: "Overdue", tone: "red" };
  }
  if (due <= dueSoonCutoff) {
    return { stage: "Due Soon", tone: "yellow" };
  }
  return { stage: "Open", tone: "blue" };
}
