import { InvoiceIcon } from "@phosphor-icons/react";
import DetailFieldGrid from "../../../../../components/dataSidebar/DetailFieldGrid";
import CardLayout from "../../../../../components/cardLayout/CardLayout";
import SectionHeader from "../../../../../components/sectionHeader/SectionHeader";
import LoadingIcon from "../../../../../components/loadingIcon/LoadingIcon";
import NoResult from "../../../../../components/crud/noResult/NoResult";
import DataTable from "../../../../../components/dataTable/DataTable";
import { formatDate } from "../../../../../functions/formatDate";
import { useBillLines } from "../../../../../features/finance/bills/private/hooks/useBillLines";
import { billLinesTableConfig } from "./billLinesTableConfig";

/**
 * Read-only detail view for a vendor bill -- no Edit button anywhere, no
 * isEditing/setIsEditing received, which is what keeps DataSidebar
 * permanently in its read-only (children-only) mode for this entity.
 */
export default function BillSidebar({ selectedRow }) {
  const {
    data: lines,
    isLoading,
    error,
  } = useBillLines(selectedRow?.doc_entry);

  const columns = billLinesTableConfig();
  const hasData = lines?.length > 0;
  const outstanding =
    (selectedRow.total_amount_myr || 0) - (selectedRow.paid_to_date || 0);

  return (
    <>
      <CardLayout style="cardLayout1 generalCard cardPadding">
        <DetailFieldGrid
          fields={[
            { label: "Bill #", value: selectedRow.bill_number },
            { label: "Vendor", value: selectedRow.vendor_name },
            {
              label: "Bill Date",
              value: formatDate(selectedRow.bill_date),
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
        <SectionHeader icon={InvoiceIcon} title="Line Items" />

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
