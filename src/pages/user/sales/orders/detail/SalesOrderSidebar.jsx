import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  FileTextIcon,
  HandshakeIcon,
  ReceiptIcon,
  CaretDownIcon,
  CaretUpIcon,
  CaretRightIcon,
} from "@phosphor-icons/react";
import CardLayout from "../../../../../components/cardLayout/CardLayout";
import SectionHeader from "../../../../../components/sectionHeader/SectionHeader";
import MatchConnector from "../../../../../components/matchConnector/MatchConnector";
import LoadingIcon from "../../../../../components/loadingIcon/LoadingIcon";
import NoResult from "../../../../../components/crud/noResult/NoResult";
import buildFilterUrl from "../../../../../functions/convertFilter";
import { useFulfillmentOrder } from "../../../../../features/sales/orders/private/hooks/useFulfillmentOrder";
import { useSalesOrderLines } from "../../../../../features/sales/orders/private/hooks/useSalesOrderLines";
import { useLeadByPoNumber } from "../../../../../features/sales/leads/private/hooks/useLeadByPoNumber";
import { useInvoicesForSalesOrder } from "../../../../../features/finance/invoices/private/hooks/useInvoicesForSalesOrder";
import { usePaymentsForSalesOrder } from "../../../../../features/finance/payments/private/hooks/usePaymentsForSalesOrder";
import { useAccessControl } from "../../../../../context/AccessControlContext";
import "./SalesOrderSidebar.scss";
import SalesOrderLineCard from "../../../../../components/sales/orders/salesOrderLineCard/SalesOrderLineCard";
import SalesOrderFulfillmentStage from "../../../../../components/sales/orders/salesOrderFulfillmentStage/SalesOrderFulfillmentStage";
import InvoiceCard from "../../../../../components/finance/invoiceCard/InvoiceCard";
import PaymentCard from "../../../../../components/finance/paymentCard/PaymentCard";
import RouterButton from "../../../../../components/buttons/routerButton/RouterButton";
import FulfillmentOrderCard from "../../../../../components/sales/orders/fulfillmentOrderCard/FulfillmentOrderCard";

/**
 * Detail sidebar for the Sales Orders page. Order Lines/Matched
 * Invoice(s)/Matched Payment(s) are each collapsed by default -- their data
 * only fetches once the viewer actually expands that section (see
 * useSalesOrderLines/useInvoicesForSalesOrder/usePaymentsForSalesOrder's own
 * `enabled` param), and each carries a "View all" button (styled after
 * PayrollReconciliationSidebar.jsx's own precedent) drilling through to the
 * real Invoices/Payments list, filtered to exactly this order's own matched
 * doc_entrys via the `docEntries` filter (invoicesService.js/
 * paymentsService.js).
 */
export default function SalesOrderSidebar({ selectedRow }) {
  const { canAccess } = useAccessControl();

  // Same queryKey shape as Orders.jsx's own fallback useFulfillmentOrder
  // call, so React Query dedupes into a single network request when both
  // fire for the same docEntry (a direct/shared URL case).
  const { data: fulfillmentOrder } = useFulfillmentOrder(
    selectedRow?.doc_entry,
  );

  // Collapsible sections -- collapsed by default; each one's own fetch is
  // gated on its own open state below.
  const [linesOpen, setLinesOpen] = useState(false);
  const [invoicesOpen, setInvoicesOpen] = useState(false);
  const [paymentsOpen, setPaymentsOpen] = useState(false);

  const {
    data: lines,
    isLoading,
    error,
  } = useSalesOrderLines(selectedRow?.doc_entry, linesOpen);

  // Reverse of LeadSidebar.jsx's "MATCHED SAP SALES ORDER" block --
  // customer_ref (SAP NumAtCard) matched against sales_leads.po_number.
  // po_number is UNIQUE, so this is at most one lead, no 0/1/many handling
  // needed here. Cheap/always-on (not gated by any toggle) -- the stage
  // tracker above needs this immediately, not just an expanded section.
  const { data: matchedLead } = useLeadByPoNumber(selectedRow?.customer_ref);

  const {
    data: matchedInvoices = [],
    isLoading: matchedInvoicesLoading,
    error: matchedInvoicesError,
  } = useInvoicesForSalesOrder(selectedRow?.doc_entry, invoicesOpen);

  const {
    data: matchedPayments = [],
    isLoading: matchedPaymentsLoading,
    error: matchedPaymentsError,
  } = usePaymentsForSalesOrder(selectedRow?.doc_entry, paymentsOpen);

  const hasLineData = lines?.length > 0;

  const isFullyDelivered = fulfillmentOrder?.is_fully_delivered ?? false;
  const totalDeliveredQty = fulfillmentOrder?.total_delivered_qty ?? 0;
  const matchedInvoiceCount = fulfillmentOrder?.matched_invoice_count ?? 0;
  const hasPaidMismatch = fulfillmentOrder?.has_paid_mismatch ?? false;
  const isFullyPaid = fulfillmentOrder?.is_fully_paid ?? false;

  const canAccessFinance = canAccess({ departments: ["FIN", "MGM"] });

  const invoicesFilterUrl = buildFilterUrl({
    docEntries: matchedInvoices.map((invoice) => invoice.doc_entry),
  });
  const paymentsFilterUrl = buildFilterUrl({
    docEntries: matchedPayments.map((payment) => payment.doc_entry),
  });

  return (
    <div className="salesOrderSidebar">
      {/* FULFILLMENT STAGE TRACKER -- mirrors where <LeadStage> sits in
          LeadSidebar.jsx. */}
      <SalesOrderFulfillmentStage
        isCancelled={selectedRow?.is_cancelled === "Y"}
        hasMatchedLead={!!matchedLead}
        leadHref={
          matchedLead ? `/app/sales/leads/list/${matchedLead.id}` : undefined
        }
        isFullyDelivered={isFullyDelivered}
        totalDeliveredQty={totalDeliveredQty}
        matchedInvoiceCount={matchedInvoiceCount}
        isFullyPaid={isFullyPaid}
        hasPaidMismatch={hasPaidMismatch}
        vertical
      />

      <FulfillmentOrderCard order={selectedRow} showStage={false} />

      {matchedLead && canAccess({ departments: ["SAL", "MGM"] }) && (
        <RouterButton
          to={`/app/sales/leads/list/${matchedLead.id}`}
          name="View Matching Lead"
          icon={HandshakeIcon}
          style="button buttonType4 textXXS"
        />
      )}

      {/* ORDER LINES -- collapsible + lazy-loaded. */}
      <CardLayout style="generalCard cardPaddingSmall">
        <button
          type="button"
          className="salesOrderSidebarSectionToggle"
          onClick={() => setLinesOpen((open) => !open)}
        >
          <SectionHeader icon={FileTextIcon} title="Order Lines" />
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
              ) : !hasLineData ? (
                <NoResult />
              ) : (
                <CardLayout style="cardLayout1 cardPaddingSmall cardGapSmall">
                  {lines.map((line) => (
                    <SalesOrderLineCard key={line.line_num} line={line} />
                  ))}
                </CardLayout>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </CardLayout>

      {/* MATCHED INVOICE(S) -- live lookup via SAP's real document trail
          (sap_invoice_lines.base_entry/base_type), not a persisted bridge.
          Reverse of InvoiceSidebar.jsx's "MATCHED SALES ORDER(S)" block.
          Collapsible + lazy-loaded, plus a "View all" drill-through filtered
          to exactly these matched doc_entrys. */}
      <CardLayout style="generalCard matchedSection cardPaddingSmall">
        <button
          type="button"
          className="salesOrderSidebarSectionToggle"
          onClick={() => setInvoicesOpen((open) => !open)}
        >
          <MatchConnector label="Matched Invoice(s)" icon={ReceiptIcon} />
          {invoicesOpen ? (
            <CaretUpIcon size={18} />
          ) : (
            <CaretDownIcon size={18} />
          )}
        </button>

        <AnimatePresence mode="wait">
          {invoicesOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: -5 }}
              animate={{ opacity: 1, height: "auto", y: 0 }}
              exit={{ opacity: 0, height: 0, y: -5 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              style={{ width: "100%" }}
            >
              {matchedInvoicesLoading ? (
                <LoadingIcon />
              ) : matchedInvoicesError ? (
                <NoResult title="Error checking for a matching invoice" />
              ) : matchedInvoices.length === 0 ? (
                <NoResult title="No matching invoice found" />
              ) : (
                <>
                  <CardLayout style="cardLayout1 cardPaddingSmall cardGapSmall">
                    {matchedInvoices.map((invoice) => (
                      <InvoiceCard
                        key={invoice.doc_entry}
                        invoice={invoice}
                        to={
                          canAccessFinance
                            ? `/app/finance/invoices/${invoice.doc_entry}?search=${invoice.invoice_number}`
                            : undefined
                        }
                      />
                    ))}
                  </CardLayout>
                  {canAccessFinance && (
                    <RouterButton
                      to={`/app/finance/invoices${invoicesFilterUrl}`}
                      style="textRegular textXXS button buttonType4"
                      icon={CaretRightIcon}
                      name={`View all ${matchedInvoices.length} invoice${matchedInvoices.length === 1 ? "" : "s"}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  )}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </CardLayout>

      {/* MATCHED PAYMENT(S) -- transitive live lookup: SO -> matched
          invoice(s) above -> payment(s) applied to those invoices (SAP has
          no direct SO->Payment link). Flat across every matched invoice.
          Collapsible + lazy-loaded, plus a "View all" drill-through. */}
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
                <>
                  <CardLayout style="cardLayout1 cardPaddingSmall cardGapSmall">
                    {matchedPayments.map((payment) => (
                      <PaymentCard
                        key={payment.doc_entry}
                        payment={payment}
                        to={
                          canAccessFinance
                            ? `/app/finance/payments/${payment.doc_entry}?search=${payment.receipt_number}`
                            : undefined
                        }
                      />
                    ))}
                  </CardLayout>
                  {canAccessFinance && (
                    <RouterButton
                      to={`/app/finance/payments${paymentsFilterUrl}`}
                      style="textRegular textXXS button buttonType4"
                      icon={CaretRightIcon}
                      name={`View all ${matchedPayments.length} payment${matchedPayments.length === 1 ? "" : "s"}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  )}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </CardLayout>
    </div>
  );
}
