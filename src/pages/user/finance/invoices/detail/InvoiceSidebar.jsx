import { FileTextIcon, ReceiptIcon } from "@phosphor-icons/react";
import { useNavigate } from "react-router";
import CardLayout from "../../../../../components/cardLayout/CardLayout";
import SectionHeader from "../../../../../components/sectionHeader/SectionHeader";
import MatchConnector from "../../../../../components/matchConnector/MatchConnector";
import LoadingIcon from "../../../../../components/loadingIcon/LoadingIcon";
import NoResult from "../../../../../components/crud/noResult/NoResult";
import { useInvoiceLines } from "../../../../../features/finance/invoices/private/hooks/useInvoiceLines";
import { useSalesOrdersForInvoice } from "../../../../../features/sales/orders/private/hooks/useSalesOrdersForInvoice";
import { usePaymentsForInvoice } from "../../../../../features/finance/payments/private/hooks/usePaymentsForInvoice";
import { useAccessControl } from "../../../../../context/AccessControlContext";
import SalesOrderCard from "../../../../../components/sales/orders/salesOrderCard/SalesOrderCard";
import InvoiceLineCard from "../../../../../components/finance/invoiceLineCard/InvoiceLineCard";
import InvoiceCard from "../../../../../components/finance/invoiceCard/InvoiceCard";
import PaymentCard from "../../../../../components/finance/paymentCard/PaymentCard";

/**
 * Read-only detail view for an invoice -- no Edit button anywhere, no
 * isEditing/setIsEditing received, which is what keeps DataSidebar
 * permanently in its read-only (children-only) mode for this entity.
 */
export default function InvoiceSidebar({ selectedRow }) {
  const navigate = useNavigate();
  const { canAccess } = useAccessControl();
  const {
    data: lines,
    isLoading,
    error,
  } = useInvoiceLines(selectedRow?.doc_entry);

  // Resolved via SAP's real document trail (sap_invoice_lines'
  // base_entry/base_type), not the free-typed PO number -- see
  // salesOrdersService.js's fetchSalesOrdersForInvoice for why. Mirrors
  // LeadSidebar.jsx's "MATCHED SAP SALES ORDER" block.
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
  } = usePaymentsForInvoice(selectedRow?.doc_entry);

  const hasData = lines?.length > 0;

  return (
    <div className="salesOrderSidebar">
      <InvoiceCard invoice={selectedRow} onClick={() => {}} />

      {/* MATCHED SALES ORDER(S) -- live lookup via SAP's real document trail
          (sap_invoice_lines.base_entry/base_type), not a persisted bridge.
          Mirrors LeadSidebar.jsx's "MATCHED SAP SALES ORDER" block. Each
          matched card deep-links straight to that order's own detail page
          (/app/sales/orders/all/:docEntry), gated the same as any other
          Sales Orders link -- only shown to users who'd actually pass that
          route's own access check (SalesRoutes.jsx:
          departments=["SAL","MGM"]). */}
      <MatchConnector label="Matched Sales Order(s)" icon={ReceiptIcon} />
      <CardLayout style="generalCard matchedSection cardPaddingSmall">
        {matchedOrdersLoading ? (
          <LoadingIcon />
        ) : matchedOrdersError ? (
          <NoResult title="Error checking for a matching sales order" />
        ) : matchedOrders.length === 0 ? (
          <NoResult title="No matching sales order found" />
        ) : (
          <CardLayout style="cardLayout1 cardPaddingSmall cardGapSmall">
            {matchedOrders.map((order) => (
              <SalesOrderCard
                key={order.doc_entry}
                order={order}
                onClick={
                  canAccess({ departments: ["SAL", "MGM"] })
                    ? () =>
                        navigate(
                          `/app/sales/orders/all/${order.doc_entry}?search=${order.so_number}`,
                        )
                    : undefined
                }
              />
            ))}
          </CardLayout>
        )}
      </CardLayout>

      {/* MATCHED PAYMENT(S) -- live lookup via SAP's real document trail
          (sap_payment_applications.doc_entry/inv_type), not a persisted
          bridge. Reverse of PaymentSidebar.jsx's per-application invoice
          enrichment. No canAccess gate needed -- Invoices and Payments are
          both gated under the same departments=["FIN"], unlike the
          Sales/Finance split the Sales Order match above needs. */}
      <MatchConnector label="Matched Payment(s)" icon={FileTextIcon} />
      <CardLayout style="generalCard matchedSection cardPaddingSmall">
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
                onClick={() =>
                  navigate(
                    `/app/finance/payments/${payment.doc_entry}?search=${payment.receipt_number}`,
                  )
                }
              />
            ))}
          </CardLayout>
        )}
      </CardLayout>

      <CardLayout style="generalCard cardPaddingSmall">
        <SectionHeader icon={FileTextIcon} title="Line Items" />

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
      </CardLayout>
    </div>
  );
}
