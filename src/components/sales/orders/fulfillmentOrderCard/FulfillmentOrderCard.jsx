import StatusBox from "../../../status/statusBox/StatusBox";
import { formatDate } from "../../../../functions/formatDate";
import "./FulfillmentOrderCard.scss";
import IconCard from "../../../iconCard/IconCard";
import { ClockIcon } from "@phosphor-icons/react";
import StatusBadge from "../../../status/statusBadge/StatusBadge";
import { motion } from "framer-motion";
import { Link } from "react-router";
import SalesRepBadge from "../../../employees/salesRepBadge/SalesRepBadge";
import SAPCustomerCard from "../../../client/sapCustomerCard/SAPCustomerCard";
import SalesOrderFulfillmentStage, {
  getFulfillmentStageSummary,
} from "../salesOrderFulfillmentStage/SalesOrderFulfillmentStage";
import { compactCurrency } from "../../../../functions/formatNumber";
import CardLayout from "../../../cardLayout/CardLayout";

const MotionLink = motion.create(Link);

/**
 * Sales Orders list card -- its own layout, not a reuse of the plain
 * SalesOrderCard.jsx (still used by LeadSidebar/InvoiceSidebar's matched-order
 * cards, which don't need the fulfillment trail), but deliberately close to
 * it in spirit: same header row shape (status/PO badges on the left, dates on
 * the right) and the same className family (salesOrderCard/
 * salesOrderCardHeader/...) for that section, so it reads as a natural
 * sibling. Below that, a dedicated figures grid (own classNames) fits the
 * extra fulfillment money trail -- Total Order sitting next to Total
 * Invoiced/Paid/Outstanding -- properly instead of squeezed into
 * SalesOrderCard's own narrow one-line "Total/Gross Profit" column. The stage
 * tracker (SalesOrderFulfillmentStage, non-vertical) plus a plain-text
 * current-stage badge sit above both, in their own row. Every fulfillment
 * column read here (is_fully_delivered/matched_invoice_count/
 * total_invoiced_myr/etc.) comes straight off
 * sap_sales_orders_with_fulfillment -- this page's list query (see
 * fulfillmentOrdersService.js).
 */
function FulfillmentOrderCard({ order, to, showStage = true }) {
  const isOpen = order.status_code === "O";
  const total = order.total_amount_myr || 0;
  const gp = order.gross_profit;
  const grossProfitDisplay =
    gp == null || Math.abs(gp) > Math.abs(total) * 5
      ? "—"
      : `RM ${Math.round(gp).toLocaleString()}`;
  const rep = order.rep;

  // total_open_qty is the REMAINING undelivered quantity (SAP's own
  // RDR1.OpenQty), not the originally ordered quantity -- so the order's
  // full line quantity is delivered + still-open, not open alone.
  const totalQty =
    (order.total_delivered_qty || 0) + (order.total_open_qty || 0);
  const deliveredQtyDisplay = `${Math.round(order.total_delivered_qty || 0).toLocaleString()} / ${Math.round(totalQty).toLocaleString()}`;

  const { stage, flags } = getFulfillmentStageSummary({
    isCancelled: order.is_cancelled === "Y",
    isFullyDelivered: order.is_fully_delivered,
    totalDeliveredQty: order.total_delivered_qty,
    matchedInvoiceCount: order.matched_invoice_count,
    isFullyPaid: order.is_fully_paid,
    hasPaidMismatch: order.has_paid_mismatch,
  });
  const stageBadgeType =
    stage === "Order Cancelled"
      ? "red"
      : stage === "Fully Paid"
        ? "green"
        : stage === "Order Created"
          ? "grey"
          : "blue";

  const Wrapper = to ? MotionLink : motion.div;
  const wrapperProps = to
    ? {
        to,
        className: "generalCard salesOrderCard fulfillmentOrderCard",
        initial: { y: 0 },
        whileHover: { y: -3 },
        transition: { duration: 0.05 },
      }
    : {
        className: "generalCard salesOrderCard fulfillmentOrderCard",
        initial: { y: 0 },
      };
  return (
    <Wrapper {...wrapperProps}>
      <div className="fulfillmentOrderCardHeader">
        <div className="fulfillmentOrderCardStatus">
          <StatusBadge
            status={isOpen ? "Open" : "Closed"}
            type={isOpen ? "green" : "grey"}
          />
          {order.is_cancelled === "Y" && (
            <StatusBox status="Cancelled" type="red" />
          )}
        </div>

        <div className="fulfillmentOrderCardDates">
          <IconCard
            icon={ClockIcon}
            weight="fill"
            name={
              order.order_date ? `Order: ${formatDate(order.order_date)}` : "—"
            }
            style="blue textXXXS textBold"
          />
          <IconCard
            icon={ClockIcon}
            weight="fill"
            name={
              order.delivery_date
                ? `Delivery: ${formatDate(order.delivery_date)}`
                : "—"
            }
            style="yellow textXXXS textBold"
          />
        </div>
      </div>

      {showStage && (
        <div className="fulfillmentOrderCardStageRow">
          <SalesOrderFulfillmentStage
            isCancelled={order.is_cancelled === "Y"}
            hasMatchedLead={!!order.has_matched_lead}
            isFullyDelivered={order.is_fully_delivered}
            totalDeliveredQty={order.total_delivered_qty}
            matchedInvoiceCount={order.matched_invoice_count}
            isFullyPaid={order.is_fully_paid}
            hasPaidMismatch={order.has_paid_mismatch}
          />

          <div className="fulfillmentOrderCardStageSummary">
            <StatusBox status={stage} type={stageBadgeType} />
            {flags.map((flag) => (
              <StatusBox
                key={flag.text}
                status={flag.text}
                type={flag.tone === "warning" ? "yellow" : "blue"}
              />
            ))}
          </div>
        </div>
      )}

      <CardLayout style="cardLayout2">
        <p className="textBold textXS">SO# {order.so_number}</p>

        <SAPCustomerCard row={order} />

        <StatusBox
          status={order.customer_ref ? `PO: ${order.customer_ref}` : "PO: —"}
          type={order.customer_ref ? "green" : "grey"}
        />
        <SalesRepBadge rep={rep} repCode={order.sales_rep_code} />
      </CardLayout>

      {/* FIGURES -- Total Order sits next to Total Invoiced/Paid/Outstanding
          so the whole money trail reads together, instead of Total (RM)
          living up in the header (SalesOrderCard's own layout) while the
          rest sat in a separate, disconnected block below it. Delivered is
          shown as delivered/total qty (not a record count -- that column,
          delivery_record_count, is informational-only per this view's own
          header comment and stays sidebar-only) since a raw quantity alone
          doesn't say whether that's a little or a lot of the order. */}
      <div className="fulfillmentOrderCardFigures cardLayout2 cardGapSmall cardLayoutMin2">
        <p className="textLight textXXS">
          <strong className="textBold">Order:</strong> RM{" "}
          {Math.round(total).toLocaleString()}
        </p>
        <p className="textLight textXXS">
          <strong className="textBold">Delivered QTY:</strong>{" "}
          {deliveredQtyDisplay}
        </p>
        <p className="textLight textXXS">
          <strong className="textBold">
            Invoiced ({order.matched_invoice_count || 0}):
          </strong>{" "}
          {compactCurrency(order.total_invoiced_myr)}
        </p>
        <p className="textLight textXXS">
          <strong className="textBold">Paid:</strong>{" "}
          {compactCurrency(order.total_paid_myr)}
        </p>
        <p className="textLight textXXS">
          <strong className="textBold">Outstanding:</strong>{" "}
          {compactCurrency(order.total_outstanding_myr)}
        </p>
        <p className="textLight textXXS">
          <strong className="textBold">Gross Profit:</strong>{" "}
          {grossProfitDisplay}
        </p>
      </div>
    </Wrapper>
  );
}

export default FulfillmentOrderCard;
