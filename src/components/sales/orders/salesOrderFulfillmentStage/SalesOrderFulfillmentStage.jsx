import { Link } from "react-router";
import StatusBox from "../../../status/statusBox/StatusBox";
import "./SalesOrderFulfillmentStage.scss";

const FULFILLMENT_STAGES = [
  { key: "leadMatched", label: "Lead Matched" },
  { key: "orderCreated", label: "Order Created" },
  // label is dynamic (see getLabel below) -- "Delivery in Progress" until
  // reached, "Delivered" once it is.
  { key: "delivered", label: null },
  { key: "invoiced", label: "Invoiced" },
  // label is dynamic too -- "Fully Paid" normally, "Fully Paid (Verify)"
  // when hasPaidMismatch flags the underlying figures as disagreeing.
  { key: "fullyPaid", label: null },
];

function getLabel(stage, isActive, isWarning) {
  if (stage.key === "delivered") {
    return isActive ? "Delivered" : "Delivery in Progress";
  }
  if (stage.key === "fullyPaid") {
    return isWarning ? "Fully Paid (Verify)" : "Fully Paid";
  }
  return stage.label;
}

/**
 * Plain-text "current stage + anomaly flag(s)" summary, for a compact badge
 * next to the dot tracker (e.g. FulfillmentOrderCard.jsx's list card) --
 * same inputs as this component itself, so both stay in sync by
 * construction rather than by two copies of this logic agreeing by luck.
 *
 * "Current stage" is the furthest of Fully Paid > Invoiced > Delivered >
 * Delivery In Progress > Order Created that's actually reached -- NOT a
 * strict left-to-right walk of FULFILLMENT_STAGES, since (as this file's own
 * header comment already establishes) the real data isn't always monotonic:
 * an order can be Invoiced or even Fully Paid while Delivered's own signal
 * still disagrees. Lead Matched is deliberately excluded -- it's a parallel
 * tag, not a sequential milestone (Order Created is trivially always true,
 * so it would never be "current" anyway).
 *
 * Flags separate genuine structural anomalies (tone: "warning" -- the same
 * two cases that turn a circle yellow above: fully paid without delivery
 * confirmed, or fully paid with a paid/applied mismatch) from a merely
 * informational note (tone: "info" -- delivery is only partial while
 * invoicing has already moved past it, which is a normal, expected SAP
 * pattern, not a data problem). A flag is never emitted when the plain stage
 * text already says the same thing (e.g. no redundant "Partial Delivery"
 * info flag when the current stage already IS "Delivery In Progress").
 */
export function getFulfillmentStageSummary({
  isCancelled,
  isFullyDelivered,
  totalDeliveredQty,
  matchedInvoiceCount,
  isFullyPaid,
  hasPaidMismatch,
}) {
  if (isCancelled) {
    return { stage: "Order Cancelled", flags: [] };
  }

  const hasPartialDelivery = !isFullyDelivered && (totalDeliveredQty || 0) > 0;

  let stage;
  if (isFullyPaid) stage = "Fully Paid";
  else if ((matchedInvoiceCount || 0) > 0) stage = "Invoiced";
  else if (isFullyDelivered) stage = "Delivered";
  else if (hasPartialDelivery) stage = "Delivery In Progress";
  else stage = "Order Created";

  const flags = [];

  if (isFullyPaid && !isFullyDelivered) {
    flags.push({
      text: hasPartialDelivery ? "Fully Paid, Partially Delivered" : "Fully Paid, Not Delivered",
      tone: "warning",
    });
  }

  if (isFullyPaid && hasPaidMismatch) {
    flags.push({ text: "Payment Mismatch", tone: "warning" });
  }

  if (!isFullyPaid && hasPartialDelivery && stage !== "Delivery In Progress") {
    flags.push({ text: "Partial Delivery", tone: "info" });
  }

  return { stage, flags };
}

/**
 * Experimental (2026-09) -- read-only fulfillment-stage tracker for a Sales
 * Order, copy-adapted from LeadStage.jsx (confirmed hardcoded/non-generic
 * there, so copying matches this codebase's own per-entity-component
 * convention rather than genericizing a component that's never been
 * generalized before).
 *
 * Color model, finalized 2026-09 after walking the full scenario table with
 * the user (not derived unilaterally):
 * - grey  = stage not reached.
 * - blue  = stage reached, order not yet fully paid -- normal progress.
 * - green = stage reached AND the order is fully paid -- but green is
 *   never a blind "fully paid means everything is green" overlay. It only
 *   applies to a stage whose OWN signal also agrees the order is done.
 * - yellow = the order IS fully paid, but THIS stage's own signal
 *   disagrees -- a genuine inconsistency worth flagging, not "just not
 *   there yet." Exactly two stages can ever produce this, both structural:
 *   - Delivered: isFullyPaid=true but isFullyDelivered=false (money
 *     cleared, delivery not confirmed complete).
 *   - Fully Paid itself: isFullyPaid=true but hasPaidMismatch=true (the
 *     paid_to_date/applied_payment reconciliation from
 *     finance_outstanding_balance_views.sql disagrees, so the "fully paid"
 *     determination is itself unverified).
 *   Lead Matched/Order Created/Invoiced can never be yellow: Order Created
 *   is trivially always true, and isFullyPaid structurally implies
 *   matchedInvoiceCount > 0 (see sap_sales_orders_with_fulfillment_view.sql),
 *   so Invoiced can never disagree with a fully-paid order. Lead Matched
 *   unreached is never anomalous either way (see below) -- it just never
 *   turns green if there was never a lead to match, fully paid or not.
 *
 * isCancelled (is_cancelled='Y' on the order) replaces the entire tracker
 * with a single Cancelled indicator -- forcing a cancelled order through
 * five fulfillment stages doesn't mean anything, per the user's own
 * decision on this exact question.
 */
export default function SalesOrderFulfillmentStage({
  isCancelled,
  hasMatchedLead,
  leadHref,
  isFullyDelivered,
  totalDeliveredQty,
  matchedInvoiceCount,
  isFullyPaid,
  hasPaidMismatch,
  vertical,
}) {
  if (isCancelled) {
    return (
      <div
        className={`salesOrderFulfillmentStageContainer ${vertical ? "vertical" : ""}`}
      >
        <StatusBox status="Order Cancelled" type="red" />
      </div>
    );
  }

  const reached = {
    leadMatched: !!hasMatchedLead,
    orderCreated: true,
    delivered: !!isFullyDelivered,
    invoiced: (matchedInvoiceCount || 0) > 0,
    fullyPaid: !!isFullyPaid,
  };

  // Delivered has a genuine third "in progress" read (sum(delivered_qty) > 0
  // per SAP's own live sap_sales_order_lines data, NOT a proxy off invoice
  // existence -- an order can be invoiced via the direct base_type=17 path
  // with zero actual delivery tracked). Every other stage is a plain
  // binary with no "how much" to it.
  function getStageState(stage) {
    if (stage.key === "delivered") {
      if (reached.delivered) return isFullyPaid ? "won" : "active";
      if (isFullyPaid) return "warning"; // paid in full, delivery unconfirmed
      if ((totalDeliveredQty || 0) > 0) return "active";
      return "";
    }

    if (stage.key === "fullyPaid") {
      if (!reached.fullyPaid) return "";
      return hasPaidMismatch ? "warning" : "won";
    }

    if (!reached[stage.key]) return "";
    return isFullyPaid ? "won" : "active";
  }

  return (
    <div
      className={`salesOrderFulfillmentStageContainer ${vertical ? "vertical" : ""}`}
    >
      {FULFILLMENT_STAGES.map((stage, index) => {
        const isActive = reached[stage.key];
        const stageState = getStageState(stage);
        const isLinkable = stage.key === "leadMatched" && isActive && leadHref;

        const label = (
          <p className={`salesOrderFulfillmentStageLabel ${stageState}`}>
            {getLabel(stage, isActive, stageState === "warning")}
          </p>
        );

        return (
          <div
            key={stage.key}
            className={vertical ? "salesOrderFulfillmentStageWrapper" : ""}
          >
            <div
              className={`salesOrderFulfillmentStageCircleContainer ${vertical ? "vertical" : ""}`}
            >
              <div
                className={`salesOrderFulfillmentStageCircle ${stageState} ${vertical ? "vertical" : ""} ${isLinkable ? "linkable" : ""}`}
              />

              {index !== FULFILLMENT_STAGES.length - 1 && (
                <div
                  className={`salesOrderFulfillmentStageLine ${stageState} ${vertical ? "vertical" : ""}`}
                />
              )}
            </div>

            {vertical && (
              <div className="salesOrderFulfillmentStageDetails">
                {isLinkable ? (
                  <Link to={leadHref} className="salesOrderFulfillmentStageLink">
                    {label}
                  </Link>
                ) : (
                  label
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
