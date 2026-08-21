import { InvoiceIcon } from "@phosphor-icons/react";
import { useNavigate } from "react-router";
import DetailFieldGrid from "../../../../../components/dataSidebar/DetailFieldGrid";
import CardLayout from "../../../../../components/cardLayout/CardLayout";
import SectionHeader from "../../../../../components/sectionHeader/SectionHeader";
import IconCard from "../../../../../components/iconCard/IconCard";
import LoadingIcon from "../../../../../components/loadingIcon/LoadingIcon";
import NoResult from "../../../../../components/crud/noResult/NoResult";
import { formatDate } from "../../../../../functions/formatDate";
import { useBillLines } from "../../../../../features/finance/bills/private/hooks/useBillLines";
import { useVendorPaymentsForBill } from "../../../../../features/finance/vendorPayments/private/hooks/useVendorPaymentsForBill";
import BillLineCard from "../../../../../components/finance/billLineCard/BillLineCard";
import VendorPaymentCard from "../../../../../components/finance/vendorPaymentCard/VendorPaymentCard";

/**
 * Read-only detail view for a vendor bill -- no Edit button anywhere, no
 * isEditing/setIsEditing received, which is what keeps DataSidebar
 * permanently in its read-only (children-only) mode for this entity.
 */
export default function BillSidebar({ selectedRow }) {
  const navigate = useNavigate();
  const {
    data: lines,
    isLoading,
    error,
  } = useBillLines(selectedRow?.doc_entry);

  // Resolved via SAP's real document trail
  // (sap_vendor_payment_applications.doc_entry -> sap_vendor_bills.doc_entry,
  // filtered doc_type=18) -- reverse of VendorPaymentSidebar's per-application
  // enrichment. No canAccess gate needed -- Bills and Vendor Payments are
  // both gated under the same departments=["FIN"].
  const {
    data: matchedVendorPayments = [],
    isLoading: matchedVendorPaymentsLoading,
    error: matchedVendorPaymentsError,
  } = useVendorPaymentsForBill(selectedRow?.doc_entry);

  const hasData = lines?.length > 0;
  const outstanding =
    (selectedRow.total_amount_myr || 0) - (selectedRow.paid_to_date || 0);

  return (
    <div className="salesOrderSidebar">
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

      {/* MATCHED VENDOR PAYMENT(S) -- live lookup via SAP's real document
          trail (sap_vendor_payment_applications.doc_entry/doc_type), not a
          persisted bridge. Reverse of VendorPaymentSidebar.jsx's
          per-application bill enrichment. */}
      <CardLayout style="generalCard cardPaddingSmall">
        <IconCard
          name="Matched Vendor Payment(s)"
          icon={InvoiceIcon}
          style="textBold textXS"
        />

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
                onClick={() =>
                  navigate(
                    `/app/finance/vendor-payments/${vendorPayment.doc_entry}?search=${vendorPayment.payment_number}`,
                  )
                }
              />
            ))}
          </CardLayout>
        )}
      </CardLayout>

      <CardLayout style="sidebarTable cardWrapperScroll generalCard cardPaddingSmall">
        <SectionHeader icon={InvoiceIcon} title="Line Items" />

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
      </CardLayout>
    </div>
  );
}
