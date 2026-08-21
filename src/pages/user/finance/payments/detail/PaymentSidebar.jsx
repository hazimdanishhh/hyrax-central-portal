import { FileTextIcon } from "@phosphor-icons/react";
import { useNavigate } from "react-router";
import DetailFieldGrid from "../../../../../components/dataSidebar/DetailFieldGrid";
import CardLayout from "../../../../../components/cardLayout/CardLayout";
import SectionHeader from "../../../../../components/sectionHeader/SectionHeader";
import LoadingIcon from "../../../../../components/loadingIcon/LoadingIcon";
import NoResult from "../../../../../components/crud/noResult/NoResult";
import { formatDate } from "../../../../../functions/formatDate";
import { usePaymentApplications } from "../../../../../features/finance/payments/private/hooks/usePaymentApplications";
import PaymentApplicationCard from "../../../../../components/finance/paymentApplicationCard/PaymentApplicationCard";

/**
 * Read-only detail view for a payment -- no Edit button anywhere, no
 * isEditing/setIsEditing received, which is what keeps DataSidebar
 * permanently in its read-only (children-only) mode for this entity.
 */
export default function PaymentSidebar({ selectedRow }) {
  const navigate = useNavigate();
  const {
    data: applications,
    isLoading,
    error,
  } = usePaymentApplications(selectedRow?.doc_entry);

  const hasData = applications?.length > 0;

  return (
    <div className="salesOrderSidebar">
      <CardLayout style="cardLayout1 generalCard cardPadding">
        <DetailFieldGrid
          fields={[
            { label: "Receipt #", value: selectedRow.receipt_number },
            { label: "Customer", value: selectedRow.customer_name },
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

      <CardLayout style="sidebarTable cardWrapperScroll generalCard cardPaddingSmall">
        <SectionHeader icon={FileTextIcon} title="Payment Applications" />

        {isLoading ? (
          <LoadingIcon />
        ) : error ? (
          <NoResult title="Error loading results" />
        ) : !hasData ? (
          <NoResult />
        ) : (
          <CardLayout style="cardLayout1 cardPaddingSmall cardGapSmall">
            {applications.map((application) => (
              <PaymentApplicationCard
                key={application.doc_line}
                application={application}
                onClick={
                  application.invoice
                    ? () =>
                        navigate(
                          `/app/finance/invoices/${application.invoice.doc_entry}?search=${application.invoice.invoice_number}`,
                        )
                    : undefined
                }
              />
            ))}
          </CardLayout>
        )}
      </CardLayout>
    </div>
  );
}
