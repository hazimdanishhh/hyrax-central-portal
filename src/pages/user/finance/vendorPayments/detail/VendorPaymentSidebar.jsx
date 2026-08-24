import { FileTextIcon } from "@phosphor-icons/react";
import { useNavigate } from "react-router";
import CardLayout from "../../../../../components/cardLayout/CardLayout";
import SectionHeader from "../../../../../components/sectionHeader/SectionHeader";
import LoadingIcon from "../../../../../components/loadingIcon/LoadingIcon";
import NoResult from "../../../../../components/crud/noResult/NoResult";
import { useVendorPaymentApplications } from "../../../../../features/finance/vendorPayments/private/hooks/useVendorPaymentApplications";
import VendorPaymentApplicationCard from "../../../../../components/finance/vendorPaymentApplicationCard/VendorPaymentApplicationCard";
import VendorPaymentCard from "../../../../../components/finance/vendorPaymentCard/VendorPaymentCard";

/**
 * Read-only detail view for a vendor payment -- no Edit button anywhere, no
 * isEditing/setIsEditing received, which is what keeps DataSidebar
 * permanently in its read-only (children-only) mode for this entity.
 */
export default function VendorPaymentSidebar({ selectedRow }) {
  const navigate = useNavigate();
  const {
    data: applications,
    isLoading,
    error,
  } = useVendorPaymentApplications(selectedRow?.doc_entry);

  const hasData = applications?.length > 0;

  return (
    <div className="salesOrderSidebar">
      <VendorPaymentCard vendorPayment={selectedRow} onClick={() => {}} />

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
              <VendorPaymentApplicationCard
                key={application.doc_line}
                application={application}
                onClick={
                  application.bill
                    ? () =>
                        navigate(
                          `/app/finance/bills/${application.bill.doc_entry}?search=${application.bill.bill_number}`,
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
