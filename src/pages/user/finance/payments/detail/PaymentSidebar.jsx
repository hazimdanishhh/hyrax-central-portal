import { FileTextIcon } from "@phosphor-icons/react";
import CardLayout from "../../../../../components/cardLayout/CardLayout";
import SectionHeader from "../../../../../components/sectionHeader/SectionHeader";
import LoadingIcon from "../../../../../components/loadingIcon/LoadingIcon";
import NoResult from "../../../../../components/crud/noResult/NoResult";
import { usePaymentApplications } from "../../../../../features/finance/payments/private/hooks/usePaymentApplications";
import PaymentApplicationCard from "../../../../../components/finance/paymentApplicationCard/PaymentApplicationCard";
import PaymentCard from "../../../../../components/finance/paymentCard/PaymentCard";

/**
 * Read-only detail view for a payment -- no Edit button anywhere, no
 * isEditing/setIsEditing received, which is what keeps DataSidebar
 * permanently in its read-only (children-only) mode for this entity.
 */
export default function PaymentSidebar({ selectedRow }) {
  const {
    data: applications,
    isLoading,
    error,
  } = usePaymentApplications(selectedRow?.doc_entry);

  const hasData = applications?.length > 0;

  return (
    <div className="salesOrderSidebar">
      <PaymentCard payment={selectedRow} />

      <CardLayout style="generalCard cardPaddingSmall">
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
                to={
                  application.invoice
                    ? `/app/finance/invoices/${application.invoice.doc_entry}?search=${application.invoice.invoice_number}`
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
