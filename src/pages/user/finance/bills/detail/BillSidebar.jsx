import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { InvoiceIcon, CaretDownIcon, CaretUpIcon } from "@phosphor-icons/react";
import CardLayout from "../../../../../components/cardLayout/CardLayout";
import SectionHeader from "../../../../../components/sectionHeader/SectionHeader";
import MatchConnector from "../../../../../components/matchConnector/MatchConnector";
import LoadingIcon from "../../../../../components/loadingIcon/LoadingIcon";
import NoResult from "../../../../../components/crud/noResult/NoResult";
import { useBillLines } from "../../../../../features/finance/bills/private/hooks/useBillLines";
import { useVendorPaymentsForBill } from "../../../../../features/finance/vendorPayments/private/hooks/useVendorPaymentsForBill";
import BillLineCard from "../../../../../components/finance/billLineCard/BillLineCard";
import VendorPaymentCard from "../../../../../components/finance/vendorPaymentCard/VendorPaymentCard";
import BillCard from "../../../../../components/finance/billCard/BillCard";

/**
 * Read-only detail view for a vendor bill -- no Edit button anywhere, no
 * isEditing/setIsEditing received, which is what keeps DataSidebar
 * permanently in its read-only (children-only) mode for this entity.
 * Section order/collapsible style mirrors SalesOrderSidebar.jsx (and its
 * Finance sibling InvoiceSidebar.jsx): Line Items first (collapsible +
 * lazy-loaded), then Matched Vendor Payment(s) (also collapsible -- unlike
 * InvoiceSidebar's Matched Sales Order(s), there's no "primary reason this
 * bill exists" section here, since Bills have no matched-PO concept).
 */
export default function BillSidebar({ selectedRow }) {
  // Collapsible sections -- collapsed by default; each one's own fetch is
  // gated on its own open state below.
  const [linesOpen, setLinesOpen] = useState(false);
  const [vendorPaymentsOpen, setVendorPaymentsOpen] = useState(false);

  const {
    data: lines,
    isLoading,
    error,
  } = useBillLines(selectedRow?.doc_entry, linesOpen);

  // Resolved via SAP's real document trail
  // (sap_vendor_payment_applications.doc_entry -> sap_vendor_bills.doc_entry,
  // filtered doc_type=18) -- reverse of VendorPaymentSidebar's per-application
  // enrichment. No canAccess gate needed -- Bills and Vendor Payments are
  // both gated under the same departments=["FIN"].
  const {
    data: matchedVendorPayments = [],
    isLoading: matchedVendorPaymentsLoading,
    error: matchedVendorPaymentsError,
  } = useVendorPaymentsForBill(selectedRow?.doc_entry, vendorPaymentsOpen);

  const hasData = lines?.length > 0;

  return (
    <div className="salesOrderSidebar">
      <BillCard bill={selectedRow} />

      {/* LINE ITEMS -- collapsible + lazy-loaded, same pattern as
          SalesOrderSidebar.jsx's "Order Lines". */}
      <CardLayout style="generalCard cardPaddingSmall">
        <button
          type="button"
          className="salesOrderSidebarSectionToggle"
          onClick={() => setLinesOpen((open) => !open)}
        >
          <SectionHeader icon={InvoiceIcon} title="Line Items" />
          {linesOpen ? <CaretUpIcon size={18} /> : <CaretDownIcon size={18} />}
        </button>

        <AnimatePresence mode="wait">
          {linesOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: -5 }}
              animate={{ opacity: 1, height: "auto", y: 0 }}
              exit={{ opacity: 0, height: 0, y: -5 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              {isLoading ? (
                <LoadingIcon />
              ) : error ? (
                <NoResult title="Error loading results" />
              ) : !hasData ? (
                <NoResult />
              ) : (
                <CardLayout style="cardLayout1 cardPaddingSmall cardGapSmall">
                  {lines.map((line) => (
                    <BillLineCard key={line.line_num} line={line} />
                  ))}
                </CardLayout>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </CardLayout>

      {/* MATCHED VENDOR PAYMENT(S) -- collapsible + lazy-loaded, live
          lookup via SAP's real document trail
          (sap_vendor_payment_applications.doc_entry/doc_type), not a
          persisted bridge. Reverse of VendorPaymentSidebar.jsx's
          per-application bill enrichment. */}
      <CardLayout style="generalCard matchedSection cardPaddingSmall">
        <button
          type="button"
          className="salesOrderSidebarSectionToggle"
          onClick={() => setVendorPaymentsOpen((open) => !open)}
        >
          <MatchConnector label="Matched Vendor Payment(s)" icon={InvoiceIcon} />
          {vendorPaymentsOpen ? (
            <CaretUpIcon size={18} />
          ) : (
            <CaretDownIcon size={18} />
          )}
        </button>

        <AnimatePresence mode="wait">
          {vendorPaymentsOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: -5 }}
              animate={{ opacity: 1, height: "auto", y: 0 }}
              exit={{ opacity: 0, height: 0, y: -5 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              style={{ width: "100%" }}
            >
              {matchedVendorPaymentsLoading ? (
                <LoadingIcon />
              ) : matchedVendorPaymentsError ? (
                <NoResult title="Error checking for a matching vendor payment" />
              ) : matchedVendorPayments.length === 0 ? (
                <NoResult title="No matching vendor payment found" />
              ) : (
                <CardLayout style="cardLayout1 cardPaddingSmall cardGapSmall">
                  {matchedVendorPayments.map((vendorPayment) => (
                    <VendorPaymentCard
                      key={vendorPayment.doc_entry}
                      vendorPayment={vendorPayment}
                      to={`/app/finance/bills/vendor-payments/${vendorPayment.doc_entry}?search=${vendorPayment.payment_number}`}
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
