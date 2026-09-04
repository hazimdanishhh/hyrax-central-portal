import {
  FileTextIcon,
  HandshakeIcon,
  ReceiptIcon,
} from "@phosphor-icons/react";
import DetailFieldGrid from "../../../../../components/dataSidebar/DetailFieldGrid";
import CardLayout from "../../../../../components/cardLayout/CardLayout";
import SectionHeader from "../../../../../components/sectionHeader/SectionHeader";
import MatchConnector from "../../../../../components/matchConnector/MatchConnector";
import LoadingIcon from "../../../../../components/loadingIcon/LoadingIcon";
import NoResult from "../../../../../components/crud/noResult/NoResult";
import DataTable from "../../../../../components/dataTable/DataTable";
import { formatDate } from "../../../../../functions/formatDate";
import { useSalesOrderLines } from "../../../../../features/sales/orders/private/hooks/useSalesOrderLines";
import { useLeadByPoNumber } from "../../../../../features/sales/leads/private/hooks/useLeadByPoNumber";
import { useInvoicesForSalesOrder } from "../../../../../features/finance/invoices/private/hooks/useInvoicesForSalesOrder";
import { useAccessControl } from "../../../../../context/AccessControlContext";
import { salesOrderLinesTableConfig } from "./salesOrderLinesTableConfig";
import "./SalesOrderSidebar.scss";
import SalesOrderCard from "../../../../../components/sales/orders/salesOrderCard/SalesOrderCard";
import SalesOrderLineCard from "../../../../../components/sales/orders/salesOrderLineCard/SalesOrderLineCard";
import InvoiceCard from "../../../../../components/finance/invoiceCard/InvoiceCard";
import RouterButton from "../../../../../components/buttons/routerButton/RouterButton";

/**
 * Read-only detail view for a sales order -- no Edit button anywhere, no
 * isEditing/setIsEditing received, which is what keeps DataSidebar
 * permanently in its read-only (children-only) mode for this entity.
 */
export default function SalesOrderSidebar({ selectedRow, salesReps = [] }) {
  const { canAccess } = useAccessControl();
  const {
    data: lines,
    isLoading,
    error,
  } = useSalesOrderLines(selectedRow?.doc_entry);

  // Reverse of LeadSidebar.jsx's "MATCHED SAP SALES ORDER" block --
  // customer_ref (SAP NumAtCard) matched against sales_leads.po_number.
  // po_number is UNIQUE, so this is at most one lead, no 0/1/many handling
  // needed here.
  const { data: matchedLead } = useLeadByPoNumber(selectedRow?.customer_ref);

  // Reverse of InvoiceSidebar.jsx's "MATCHED SALES ORDER(S)" block --
  // resolved via SAP's real document trail (sap_invoice_lines'
  // base_entry/base_type), not the free-typed PO number. No uniqueness
  // constraint in this chain, so this is 0/1/many (unlike matchedLead above).
  const {
    data: matchedInvoices = [],
    isLoading: matchedInvoicesLoading,
    error: matchedInvoicesError,
  } = useInvoicesForSalesOrder(selectedRow?.doc_entry);

  const columns = salesOrderLinesTableConfig();
  const hasData = lines?.length > 0;

  const salesRep = salesReps.find(
    (rep) => rep.sales_rep_code === selectedRow.sales_rep_code,
  );

  const gp = selectedRow.gross_profit;
  const total = selectedRow.total_amount_myr || 0;
  const grossProfitDisplay =
    gp == null || Math.abs(gp) > Math.abs(total) * 5
      ? "—"
      : `RM ${Math.round(gp).toLocaleString()}`;
  return (
    <div className="salesOrderSidebar">
      <SalesOrderCard order={selectedRow} />

      {matchedLead && canAccess({ departments: ["SAL", "MGM"] }) && (
        <RouterButton
          to={`/app/sales/leads/list/${matchedLead.id}`}
          name="View Matching Lead"
          icon={HandshakeIcon}
          style="button buttonType4 textXXS"
        />
      )}

      {/* MATCHED INVOICE(S) -- live lookup via SAP's real document trail
          (sap_invoice_lines.base_entry/base_type), not a persisted bridge.
          Reverse of InvoiceSidebar.jsx's "MATCHED SALES ORDER(S)" block.
          Each matched card deep-links straight to that invoice's own detail
          page (/app/finance/invoices/:docEntry), gated the same as any other
          Invoices link -- only shown to users who'd actually pass that
          route's own access check (FinanceRoutes.jsx: departments=["FIN"]). */}
      <MatchConnector label="Matched Invoice(s)" icon={ReceiptIcon} />
      <CardLayout style="generalCard matchedSection cardPaddingSmall">
        {matchedInvoicesLoading ? (
          <LoadingIcon />
        ) : matchedInvoicesError ? (
          <NoResult title="Error checking for a matching invoice" />
        ) : matchedInvoices.length === 0 ? (
          <NoResult title="No matching invoice found" />
        ) : (
          <CardLayout style="cardLayout1 cardPaddingSmall cardGapSmall">
            {matchedInvoices.map((invoice) => (
              <InvoiceCard
                key={invoice.doc_entry}
                invoice={invoice}
                to={
                  canAccess({ departments: ["FIN"] })
                    ? `/app/finance/invoices/${invoice.doc_entry}?search=${invoice.invoice_number}`
                    : undefined
                }
              />
            ))}
          </CardLayout>
        )}
      </CardLayout>

      <CardLayout style="generalCard cardPaddingSmall">
        <SectionHeader icon={FileTextIcon} title="Order Lines" />

        {isLoading ? (
          <LoadingIcon />
        ) : error ? (
          <NoResult title="Error loading results" />
        ) : !hasData ? (
          <NoResult />
        ) : (
          <CardLayout style="cardLayout1 cardPaddingSmall cardGapSmall">
            {lines.map((line) => (
              <SalesOrderLineCard key={line.line_num} line={line} />
            ))}
          </CardLayout>
        )}
      </CardLayout>
    </div>
  );
}
