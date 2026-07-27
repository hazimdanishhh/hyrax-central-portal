import { FileTextIcon } from "@phosphor-icons/react";
import DetailFieldGrid from "../../../../../components/dataSidebar/DetailFieldGrid";
import CardLayout from "../../../../../components/cardLayout/CardLayout";
import SectionHeader from "../../../../../components/sectionHeader/SectionHeader";
import LoadingIcon from "../../../../../components/loadingIcon/LoadingIcon";
import NoResult from "../../../../../components/crud/noResult/NoResult";
import DataTable from "../../../../../components/dataTable/DataTable";
import { formatDate } from "../../../../../functions/formatDate";
import { useVendorPaymentApplications } from "../../../../../features/finance/vendorPayments/private/hooks/useVendorPaymentApplications";
import { vendorPaymentApplicationsTableConfig } from "./vendorPaymentApplicationsTableConfig";

/**
 * Read-only detail view for a vendor payment -- no Edit button anywhere, no
 * isEditing/setIsEditing received, which is what keeps DataSidebar
 * permanently in its read-only (children-only) mode for this entity.
 */
export default function VendorPaymentSidebar({ selectedRow }) {
  const {
    data: applications,
    isLoading,
    error,
  } = useVendorPaymentApplications(selectedRow?.doc_entry);

  const columns = vendorPaymentApplicationsTableConfig();
  const hasData = applications?.length > 0;

  return (
    <>
      <CardLayout style="cardLayout1 generalCard cardPadding">
        <DetailFieldGrid
          fields={[
            { label: "Payment #", value: selectedRow.payment_number },
            { label: "Vendor", value: selectedRow.vendor_name },
            {
              label: "Payment Date",
              value: formatDate(selectedRow.payment_date),
            },
            {
              label: "Status",
              value: selectedRow.is_cancelled === "Y" ? "Cancelled" : "Active",
            },
            {
              label: "Total (RM)",
              value: `RM ${Math.round(selectedRow.total_amount_myr || 0).toLocaleString()}`,
            },
            {
              label: "Unallocated (RM)",
              value: `RM ${Math.round(selectedRow.unallocated_amount || 0).toLocaleString()}`,
            },
          ]}
        />
      </CardLayout>

      <CardLayout style="generalCard cardPaddingSmall">
        <SectionHeader icon={FileTextIcon} title="Payment Applications" />

        {isLoading ? (
          <LoadingIcon />
        ) : error ? (
          <NoResult title="Error loading results" />
        ) : !hasData ? (
          <NoResult />
        ) : (
          <DataTable data={applications} columns={columns} rowKey="doc_entry" />
        )}
      </CardLayout>
    </>
  );
}
