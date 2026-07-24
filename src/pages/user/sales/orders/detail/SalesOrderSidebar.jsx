import { FileTextIcon } from "@phosphor-icons/react";
import DetailFieldGrid from "../../../../../components/dataSidebar/DetailFieldGrid";
import CardLayout from "../../../../../components/cardLayout/CardLayout";
import SectionHeader from "../../../../../components/sectionHeader/SectionHeader";
import LoadingIcon from "../../../../../components/loadingIcon/LoadingIcon";
import NoResult from "../../../../../components/crud/noResult/NoResult";
import DataTable from "../../../../../components/dataTable/DataTable";
import { formatDate } from "../../../../../functions/formatDate";
import { useSalesOrderLines } from "../../../../../features/sales/orders/private/hooks/useSalesOrderLines";
import { salesOrderLinesTableConfig } from "./salesOrderLinesTableConfig";

/**
 * Read-only detail view for a sales order -- no Edit button anywhere, no
 * isEditing/setIsEditing received, which is what keeps DataSidebar
 * permanently in its read-only (children-only) mode for this entity.
 */
export default function SalesOrderSidebar({ selectedRow, salesReps = [] }) {
  const {
    data: lines,
    isLoading,
    error,
  } = useSalesOrderLines(selectedRow?.doc_entry);

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
    <>
      <CardLayout style="cardLayout1 generalCard cardPadding">
        <DetailFieldGrid
          fields={[
            { label: "SO #", value: selectedRow.so_number },
            { label: "Customer", value: selectedRow.customer_name },
            {
              label: "Sales Rep",
              value: salesRep?.sales_rep_name || "—",
            },
            {
              label: "Order Date",
              value: formatDate(selectedRow.order_date),
            },
            {
              label: "Delivery Date",
              value: formatDate(selectedRow.delivery_date),
            },
            {
              label: "Status",
              value: selectedRow.status_code === "O" ? "Open" : "Closed",
            },
            {
              label: "Total (RM)",
              value: `RM ${Math.round(total).toLocaleString()}`,
            },
            { label: "Gross Profit (RM)", value: grossProfitDisplay },
          ]}
        />
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
          <DataTable data={lines} columns={columns} rowKey="line_num" />
        )}
      </CardLayout>
    </>
  );
}
