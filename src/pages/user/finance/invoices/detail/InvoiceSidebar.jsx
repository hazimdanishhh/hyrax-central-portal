import { FileTextIcon } from "@phosphor-icons/react";
import DetailFieldGrid from "../../../../../components/dataSidebar/DetailFieldGrid";
import CardLayout from "../../../../../components/cardLayout/CardLayout";
import SectionHeader from "../../../../../components/sectionHeader/SectionHeader";
import LoadingIcon from "../../../../../components/loadingIcon/LoadingIcon";
import NoResult from "../../../../../components/crud/noResult/NoResult";
import DataTable from "../../../../../components/dataTable/DataTable";
import { formatDate } from "../../../../../functions/formatDate";
import { useInvoiceLines } from "../../../../../features/finance/invoices/private/hooks/useInvoiceLines";
import { invoiceLinesTableConfig } from "./invoiceLinesTableConfig";

/**
 * Read-only detail view for an invoice -- no Edit button anywhere, no
 * isEditing/setIsEditing received, which is what keeps DataSidebar
 * permanently in its read-only (children-only) mode for this entity.
 */
export default function InvoiceSidebar({ selectedRow }) {
  const {
    data: lines,
    isLoading,
    error,
  } = useInvoiceLines(selectedRow?.doc_entry);

  const columns = invoiceLinesTableConfig();
  const hasData = lines?.length > 0;
  const outstanding =
    (selectedRow.total_amount_myr || 0) - (selectedRow.paid_to_date || 0);

  return (
    <>
      <CardLayout style="cardLayout1 generalCard cardPadding">
        <DetailFieldGrid
          fields={[
            { label: "Invoice #", value: selectedRow.invoice_number },
            { label: "Customer", value: selectedRow.customer_name },
            {
              label: "Invoice Date",
              value: formatDate(selectedRow.invoice_date),
            },
            { label: "Due Date", value: formatDate(selectedRow.due_date) },
            {
              label: "Status",
              value: selectedRow.status_code === "O" ? "Open" : "Closed",
            },
            {
              label: "Total (RM)",
              value: `RM ${Math.round(selectedRow.total_amount_myr || 0).toLocaleString()}`,
            },
            {
              label: "Outstanding (RM)",
              value: `RM ${Math.round(outstanding).toLocaleString()}`,
            },
          ]}
        />
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
          <DataTable data={lines} columns={columns} rowKey="line_num" />
        )}
      </CardLayout>
    </>
  );
}
