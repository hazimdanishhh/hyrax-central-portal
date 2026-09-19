import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  FileTextIcon,
  CaretDownIcon,
  CaretUpIcon,
} from "@phosphor-icons/react";
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
 * Payment Applications is collapsible + lazy-loaded, same toggle/animation
 * style as SalesOrderSidebar.jsx's/InvoiceSidebar.jsx's sections.
 */
export default function VendorPaymentSidebar({ selectedRow }) {
  const [applicationsOpen, setApplicationsOpen] = useState(false);

  const {
    data: applications,
    isLoading,
    error,
  } = useVendorPaymentApplications(selectedRow?.doc_entry, applicationsOpen);

  const hasData = applications?.length > 0;

  return (
    <div className="salesOrderSidebar">
      <VendorPaymentCard vendorPayment={selectedRow} />

      <CardLayout style="generalCard cardPaddingSmall">
        <button
          type="button"
          className="salesOrderSidebarSectionToggle"
          onClick={() => setApplicationsOpen((open) => !open)}
        >
          <SectionHeader icon={FileTextIcon} title="Payment Applications" />
          {applicationsOpen ? (
            <CaretUpIcon size={18} />
          ) : (
            <CaretDownIcon size={18} />
          )}
        </button>

        <AnimatePresence mode="wait">
          {applicationsOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: -5 }}
              animate={{ opacity: 1, height: "auto", y: 0 }}
              exit={{ opacity: 0, height: 0, y: -5 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              style={{ width: "100%" }}
            >
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
                      to={
                        application.bill
                          ? `/app/finance/bills/list/${application.bill.doc_entry}?search=${application.bill.bill_number}`
                          : application.inv_entry === 0
                            ? `/app/finance/business-partners/${selectedRow.vendor_code}`
                            : undefined
                      }
                    />
                  ))}
                </CardLayout>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </CardLayout>
    </div>
  );
}
