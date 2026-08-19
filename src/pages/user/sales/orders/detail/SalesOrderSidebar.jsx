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
import "./SalesOrderSidebar.scss";
import SalesOrderCard from "../../../../../components/sales/orders/salesOrderCard/SalesOrderCard";
import SalesOrderLineCard from "../../../../../components/sales/orders/salesOrderLineCard/SalesOrderLineCard";

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
  console.log(lines);
  return (
    <div className="salesOrderSidebar">
      <SalesOrderCard order={selectedRow} onClick={() => {}} />

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
