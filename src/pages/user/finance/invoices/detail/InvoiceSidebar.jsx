import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  FileTextIcon,
  ReceiptIcon,
  CaretRightIcon,
  CaretDownIcon,
  CaretUpIcon,
} from "@phosphor-icons/react";
import CardLayout from "../../../../../components/cardLayout/CardLayout";
import SectionHeader from "../../../../../components/sectionHeader/SectionHeader";
import MatchConnector from "../../../../../components/matchConnector/MatchConnector";
import LoadingIcon from "../../../../../components/loadingIcon/LoadingIcon";
import NoResult from "../../../../../components/crud/noResult/NoResult";
import RouterButton from "../../../../../components/buttons/routerButton/RouterButton";
import { useInvoiceLines } from "../../../../../features/finance/invoices/private/hooks/useInvoiceLines";
import { useSalesOrdersForInvoice } from "../../../../../features/sales/orders/private/hooks/useSalesOrdersForInvoice";
import { usePaymentsForInvoice } from "../../../../../features/finance/payments/private/hooks/usePaymentsForInvoice";
import FulfillmentOrderCard from "../../../../../components/sales/orders/fulfillmentOrderCard/FulfillmentOrderCard";
import InvoiceLineCard from "../../../../../components/finance/invoiceLineCard/InvoiceLineCard";
import InvoiceCard from "../../../../../components/finance/invoiceCard/InvoiceCard";
import PaymentCard from "../../../../../components/finance/paymentCard/PaymentCard";

/**
 * Read-only detail view for an invoice -- no Edit button anywhere, no
 * isEditing/setIsEditing received, which is what keeps DataSidebar
 * permanently in its read-only (children-only) mode for this entity.
 * Section order/collapsible style mirrors SalesOrderSidebar.jsx: Line
 * Items first (collapsible + lazy-loaded, like Order Lines there), then
 * the matched sections. Matched Sales Order(s) is the one exception --
 * always expanded, no toggle -- since it's the primary reason this invoice
 * exists, not a secondary cross-reference like Matched Payment(s).
 */
export default function InvoiceSidebar({ selectedRow }) {
  // Collapsible sections -- collapsed by default; each one's own fetch is
  // gated on its own open state below (except Matched Sales Order(s),
  // which always fetches).
  const [linesOpen, setLinesOpen] = useState(false);
  const [paymentsOpen, setPaymentsOpen] = useState(false);

  const {
    data: lines,
    isLoading,
    error,
  } = useInvoiceLines(selectedRow?.doc_entry, linesOpen);

  // Resolved via SAP's real document trail (sap_invoice_lines'
  // base_entry/base_type), not the free-typed PO number -- see
  // salesOrdersService.js's fetchSalesOrdersForInvoice for why. Mirrors
  // LeadSidebar.jsx's "MATCHED SAP SALES ORDER" block. Always open (no
  // enabled gate) -- see header comment.
  const {
    data: matchedOrders = [],
    isLoading: matchedOrdersLoading,
    error: matchedOrdersError,
  } = useSalesOrdersForInvoice(selectedRow?.doc_entry);

  // Resolved via SAP's real document trail
  // (sap_payment_applications.doc_entry -> sap_invoices.doc_entry, filtered
  // inv_type=13) -- reverse of PaymentSidebar's per-application enrichment.
  const {
    data: matchedPayments = [],
    isLoading: matchedPaymentsLoading,
    error: matchedPaymentsError,
  } = usePaymentsForInvoice(selectedRow?.doc_entry, paymentsOpen);

  const hasData = lines?.length > 0;

  return (
    <div className="salesOrderSidebar">
      <InvoiceCard invoice={selectedRow} />

      {/* LINE ITEMS -- collapsible + lazy-loaded, same pattern as
          SalesOrderSidebar.jsx's "Order Lines". */}
      <CardLayout style="generalCard cardPaddingSmall">
        <button
          type="button"
          className="salesOrderSidebarSectionToggle"
          onClick={() => setLinesOpen((open) => !open)}
        >
          <SectionHeader icon={FileTextIcon} title="Line Items" />
          {linesOpen ? <CaretUpIcon size={18} /> : <CaretDownIcon size={18} />}
        </button>

        <AnimatePresence mode="wait">
          {linesOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: -5 }}
              animate={{ opacity: 1, height: "auto", y: 0 }}
              exit={{ opacity: 0, height: 0, y: -5 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              {isLoading ? (
                <LoadingIcon />
              ) : error ? (
                <NoResult title="Error loading results" />
              ) : !hasData ? (
                <NoResult />
              ) : (
                <CardLayout style="cardLayout1 cardPaddingSmall cardGapSmall">
                  {lines.map((line) => (
                    <InvoiceLineCard key={line.line_num} line={line} />
                  ))}
                </CardLayout>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </CardLayout>

      {/* MATCHED SALES ORDER(S) -- live lookup via SAP's real document trail
          (sap_invoice_lines.base_entry/base_type), not a persisted bridge.
          Mirrors LeadSidebar.jsx's "MATCHED SAP SALES ORDER" block. Always
          expanded, no hide/show toggle -- unlike Matched Payment(s) below,
          this is the primary reason the invoice exists, not a secondary
          cross-reference. The order card itself is always inert (no `to`,
          for every viewer including MGM/SAL) -- Finance's own pages don't
          link into Sales' module (see docs/DASHBOARD-CONVENTIONS.md §5).
          Renders FulfillmentOrderCard, not the plainer SalesOrderCard this
          used to show with a Sales-gated click-through, since Finance's
          real need here (see this order's status) is fully covered by the
          richer static summary -- a dedicated Finance-owned order-browsing
          page would just duplicate Sales' own module for a need Finance
          doesn't actually have. The "View all invoices for this order" link
          below each card stays entirely within Finance's own Invoices list
          (salesOrderDocEntry filter, invoicesService.js) -- not a link into
          Sales, just this order's own other invoices (an order can span
          several partial invoices). */}

      <CardLayout style="generalCard matchedSection cardPaddingSmall">
        {matchedOrdersLoading ? (
          <LoadingIcon />
        ) : matchedOrdersError ? (
          <NoResult title="Error checking for a matching sales order" />
        ) : matchedOrders.length === 0 ? (
          <NoResult title="No matching sales order found" />
        ) : (
          <CardLayout style="cardLayout1 cardPaddingSmall cardGapSmall">
            <MatchConnector label="Matched Sales Order(s)" icon={ReceiptIcon} />

            {matchedOrders.map((order) => (
              <CardLayout
                key={order.doc_entry}
                style="cardLayout1 cardGapSmall"
              >
                <FulfillmentOrderCard order={order} />
                <RouterButton
                  to={`/app/finance/invoices/list?salesOrderDocEntry=${order.doc_entry}`}
                  style="textRegular textXXS button buttonType4"
                  icon={CaretRightIcon}
                  name={`View all invoices for SO# ${order.so_number}`}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              </CardLayout>
            ))}
          </CardLayout>
        )}
      </CardLayout>

      {/* MATCHED PAYMENT(S) -- collapsible + lazy-loaded, live lookup via
          SAP's real document trail (sap_payment_applications.doc_entry/
          inv_type), not a persisted bridge. Reverse of PaymentSidebar.jsx's
          per-application invoice enrichment. No canAccess gate needed --
          Invoices and Payments are both gated under the same
          departments=["FIN"], unlike the Sales/Finance split the Sales
          Order match above needs. */}
      <CardLayout style="generalCard matchedSection cardPaddingSmall">
        <button
          type="button"
          className="salesOrderSidebarSectionToggle"
          onClick={() => setPaymentsOpen((open) => !open)}
        >
          <MatchConnector label="Matched Payment(s)" icon={FileTextIcon} />
          {paymentsOpen ? (
            <CaretUpIcon size={18} />
          ) : (
            <CaretDownIcon size={18} />
          )}
        </button>

        <AnimatePresence mode="wait">
          {paymentsOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: -5 }}
              animate={{ opacity: 1, height: "auto", y: 0 }}
              exit={{ opacity: 0, height: 0, y: -5 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              style={{ width: "100%" }}
            >
              {matchedPaymentsLoading ? (
                <LoadingIcon />
              ) : matchedPaymentsError ? (
                <NoResult title="Error checking for a matching payment" />
              ) : matchedPayments.length === 0 ? (
                <NoResult title="No matching payment found" />
              ) : (
                <CardLayout style="cardLayout1 cardPaddingSmall cardGapSmall">
                  {matchedPayments.map((payment) => (
                    <PaymentCard
                      key={payment.doc_entry}
                      payment={payment}
                      to={`/app/finance/invoices/payments/${payment.doc_entry}?search=${payment.receipt_number}`}
                    />
                  ))}
                </CardLayout>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </CardLayout>
    </div>
  );
}
