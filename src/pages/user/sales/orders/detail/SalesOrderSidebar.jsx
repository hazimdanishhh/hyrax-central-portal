import { FileTextIcon, HandshakeIcon } from "@phosphor-icons/react";
import DetailFieldGrid from "../../../../../components/dataSidebar/DetailFieldGrid";
import CardLayout from "../../../../../components/cardLayout/CardLayout";
import SectionHeader from "../../../../../components/sectionHeader/SectionHeader";
import LoadingIcon from "../../../../../components/loadingIcon/LoadingIcon";
import NoResult from "../../../../../components/crud/noResult/NoResult";
import DataTable from "../../../../../components/dataTable/DataTable";
import { formatDate } from "../../../../../functions/formatDate";
import { useSalesOrderLines } from "../../../../../features/sales/orders/private/hooks/useSalesOrderLines";
import { useLeadByPoNumber } from "../../../../../features/sales/leads/private/hooks/useLeadByPoNumber";
import { useAccessControl } from "../../../../../context/AccessControlContext";
import { salesOrderLinesTableConfig } from "./salesOrderLinesTableConfig";
import "./SalesOrderSidebar.scss";
import SalesOrderCard from "../../../../../components/sales/orders/salesOrderCard/SalesOrderCard";
import SalesOrderLineCard from "../../../../../components/sales/orders/salesOrderLineCard/SalesOrderLineCard";
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
      <SalesOrderCard order={selectedRow} onClick={() => {}} />

      {matchedLead && canAccess({ departments: ["SAL"] }) && (
        <RouterButton
          to={`/app/sales/leads/list/${matchedLead.id}`}
          name="View Matching Lead"
          icon={HandshakeIcon}
          style="button buttonType4 textXXS"
        />
      )}

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
