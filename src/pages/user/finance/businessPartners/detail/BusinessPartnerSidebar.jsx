import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ReceiptIcon,
  FileTextIcon,
  InvoiceIcon,
  HandCoinsIcon,
  CaretDownIcon,
  CaretUpIcon,
  CaretRightIcon,
} from "@phosphor-icons/react";
import CardLayout from "../../../../../components/cardLayout/CardLayout";
import MatchConnector from "../../../../../components/matchConnector/MatchConnector";
import LoadingIcon from "../../../../../components/loadingIcon/LoadingIcon";
import NoResult from "../../../../../components/crud/noResult/NoResult";
import RouterButton from "../../../../../components/buttons/routerButton/RouterButton";
import StatusBox from "../../../../../components/status/statusBox/StatusBox";
import buildFilterUrl from "../../../../../functions/convertFilter";
import { useInvoicesForCustomer } from "../../../../../features/finance/invoices/private/hooks/useInvoicesForCustomer";
import { usePaymentsForCustomer } from "../../../../../features/finance/payments/private/hooks/usePaymentsForCustomer";
import { useBillsForVendor } from "../../../../../features/finance/bills/private/hooks/useBillsForVendor";
import { useVendorPaymentsForVendor } from "../../../../../features/finance/vendorPayments/private/hooks/useVendorPaymentsForVendor";
import InvoiceCard from "../../../../../components/finance/invoiceCard/InvoiceCard";
import PaymentCard from "../../../../../components/finance/paymentCard/PaymentCard";
import BillCard from "../../../../../components/finance/billCard/BillCard";
import VendorPaymentCard from "../../../../../components/finance/vendorPaymentCard/VendorPaymentCard";
import "./BusinessPartnerSidebar.scss";

const CARD_TYPE_LABELS = {
  C: "Customer",
  L: "Lead",
  S: "Vendor",
};

/**
 * Read-only detail panel for a Business Partner -- ports SapClientSidebar's
 * flat contact/balance fields as-is, then adds the transactional preview
 * sections (Open Invoices/Payments for a Customer, Open Bills/Vendor
 * Payments for a Vendor) that SapClientSidebar never needed, since Sales'
 * SAP Clients has no AR/AP concept. Collapsible + lazy-loaded, same "View
 * all N" drill-through shape as SalesOrderSidebar.jsx's Matched
 * Invoice(s)/Matched Payment(s) blocks. A Lead has no AR/AP activity, so
 * neither pair renders for card_type 'L'.
 */
export default function BusinessPartnerSidebar({ selectedRow }) {
  const isCustomer = selectedRow?.card_type === "C";
  const isVendor = selectedRow?.card_type === "S";
  const customerCode = isCustomer ? selectedRow.customer_code : undefined;
  const vendorCode = isVendor ? selectedRow.customer_code : undefined;

  const [invoicesOpen, setInvoicesOpen] = useState(false);
  const [paymentsOpen, setPaymentsOpen] = useState(false);
  const [billsOpen, setBillsOpen] = useState(false);
  const [vendorPaymentsOpen, setVendorPaymentsOpen] = useState(false);

  const {
    data: invoicesResult,
    isLoading: invoicesLoading,
    error: invoicesError,
  } = useInvoicesForCustomer(customerCode, invoicesOpen);
  const invoices = invoicesResult?.data || [];
  const invoicesTotal = invoicesResult?.totalCount || 0;

  const {
    data: paymentsResult,
    isLoading: paymentsLoading,
    error: paymentsError,
  } = usePaymentsForCustomer(customerCode, paymentsOpen);
  const payments = paymentsResult?.data || [];
  const paymentsTotal = paymentsResult?.totalCount || 0;

  const {
    data: billsResult,
    isLoading: billsLoading,
    error: billsError,
  } = useBillsForVendor(vendorCode, billsOpen);
  const bills = billsResult?.data || [];
  const billsTotal = billsResult?.totalCount || 0;

  const {
    data: vendorPaymentsResult,
    isLoading: vendorPaymentsLoading,
    error: vendorPaymentsError,
  } = useVendorPaymentsForVendor(vendorCode, vendorPaymentsOpen);
  const vendorPayments = vendorPaymentsResult?.data || [];
  const vendorPaymentsTotal = vendorPaymentsResult?.totalCount || 0;

  const invoicesFilterUrl = buildFilterUrl({ customerCode });
  const paymentsFilterUrl = buildFilterUrl({ customerCode });
  const billsFilterUrl = buildFilterUrl({ vendorCode });
  const vendorPaymentsFilterUrl = buildFilterUrl({ vendorCode });

  return (
    <div className="salesOrderSidebar">
      <div className="businessPartnerSidebarHeader">
        <p className="textBold">{selectedRow.customer_name}</p>
        <p className="textLight textXXS">{selectedRow.customer_code}</p>

        <div className="businessPartnerSidebarStatusContainer">
          <StatusBox
            status={
              CARD_TYPE_LABELS[selectedRow.card_type] || selectedRow.card_type
            }
            type="blue"
          />
          {selectedRow.local_export_flag && (
            <StatusBox status={selectedRow.local_export_flag} type="yellow" />
          )}
          {selectedRow.is_active !== "Y" && (
            <StatusBox status="Inactive" type="red" />
          )}
        </div>

        <div className="generalCard cardPaddingSmall businessPartnerSidebarDetails">
          <div>
            <span className="textBold textXS">Contact Person: </span>
            <p className="textRegular textXS">
              {selectedRow.contact_person || "—"}
            </p>
          </div>
          <div>
            <span className="textBold textXS">Phone: </span>
            <p className="textRegular textXS">{selectedRow.phone || "—"}</p>
          </div>
          <div>
            <span className="textBold textXS">Email: </span>
            <p className="textRegular textXS">{selectedRow.email || "—"}</p>
          </div>
          <div>
            <span className="textBold textXS">Location: </span>
            <p className="textRegular textXS">
              {[selectedRow.city, selectedRow.country]
                .filter(Boolean)
                .join(", ") || "—"}
            </p>
          </div>
          <div>
            <span className="textBold textXS">Balance: </span>
            <p className="textRegular textXS">
              RM {Math.round(selectedRow.balance || 0).toLocaleString()}
            </p>
          </div>
          <div>
            <span className="textBold textXS">Credit Limit: </span>
            <p className="textRegular textXS">
              RM {Math.round(selectedRow.credit_limit || 0).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {isCustomer && (
        <>
          {/* OPEN INVOICES */}
          <CardLayout style="generalCard matchedSection cardPaddingSmall">
            <button
              type="button"
              className="salesOrderSidebarSectionToggle"
              onClick={() => setInvoicesOpen((open) => !open)}
            >
              <MatchConnector label="Invoices" icon={ReceiptIcon} />
              {invoicesOpen ? (
                <CaretUpIcon size={18} />
              ) : (
                <CaretDownIcon size={18} />
              )}
            </button>

            <AnimatePresence mode="wait">
              {invoicesOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0, y: -5 }}
                  animate={{ opacity: 1, height: "auto", y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -5 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  style={{ width: "100%" }}
                >
                  {invoicesLoading ? (
                    <LoadingIcon />
                  ) : invoicesError ? (
                    <NoResult title="Error loading invoices" />
                  ) : invoices.length === 0 ? (
                    <NoResult title="No invoices found" />
                  ) : (
                    <>
                      <CardLayout style="cardLayout1 cardPaddingSmall cardGapSmall">
                        {invoices.map((invoice) => (
                          <InvoiceCard
                            key={invoice.doc_entry}
                            invoice={invoice}
                            to={`/app/finance/invoices/list/${invoice.doc_entry}?search=${invoice.invoice_number}`}
                          />
                        ))}
                      </CardLayout>
                      <RouterButton
                        to={`/app/finance/invoices/list${invoicesFilterUrl}`}
                        style="textRegular textXXS button buttonType4"
                        icon={CaretRightIcon}
                        name={`View all ${invoicesTotal} invoice${invoicesTotal === 1 ? "" : "s"}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      />
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </CardLayout>

          {/* PAYMENTS */}
          <CardLayout style="generalCard matchedSection cardPaddingSmall">
            <button
              type="button"
              className="salesOrderSidebarSectionToggle"
              onClick={() => setPaymentsOpen((open) => !open)}
            >
              <MatchConnector label="Payments" icon={FileTextIcon} />
              {paymentsOpen ? (
                <CaretUpIcon size={18} />
              ) : (
                <CaretDownIcon size={18} />
              )}
            </button>

            <AnimatePresence mode="wait">
              {paymentsOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0, y: -5 }}
                  animate={{ opacity: 1, height: "auto", y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -5 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  style={{ width: "100%" }}
                >
                  {paymentsLoading ? (
                    <LoadingIcon />
                  ) : paymentsError ? (
                    <NoResult title="Error loading payments" />
                  ) : payments.length === 0 ? (
                    <NoResult title="No payments found" />
                  ) : (
                    <>
                      <CardLayout style="cardLayout1 cardPaddingSmall cardGapSmall">
                        {payments.map((payment) => (
                          <PaymentCard
                            key={payment.doc_entry}
                            payment={payment}
                            to={`/app/finance/invoices/payments/${payment.doc_entry}?search=${payment.receipt_number}`}
                          />
                        ))}
                      </CardLayout>
                      <RouterButton
                        to={`/app/finance/invoices/payments${paymentsFilterUrl}`}
                        style="textRegular textXXS button buttonType4"
                        icon={CaretRightIcon}
                        name={`View all ${paymentsTotal} payment${paymentsTotal === 1 ? "" : "s"}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      />
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </CardLayout>
        </>
      )}

      {isVendor && (
        <>
          {/* OPEN BILLS */}
          <CardLayout style="generalCard matchedSection cardPaddingSmall">
            <button
              type="button"
              className="salesOrderSidebarSectionToggle"
              onClick={() => setBillsOpen((open) => !open)}
            >
              <MatchConnector label="Bills" icon={InvoiceIcon} />
              {billsOpen ? (
                <CaretUpIcon size={18} />
              ) : (
                <CaretDownIcon size={18} />
              )}
            </button>

            <AnimatePresence mode="wait">
              {billsOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0, y: -5 }}
                  animate={{ opacity: 1, height: "auto", y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -5 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  style={{ width: "100%" }}
                >
                  {billsLoading ? (
                    <LoadingIcon />
                  ) : billsError ? (
                    <NoResult title="Error loading bills" />
                  ) : bills.length === 0 ? (
                    <NoResult title="No bills found" />
                  ) : (
                    <>
                      <CardLayout style="cardLayout1 cardPaddingSmall cardGapSmall">
                        {bills.map((bill) => (
                          <BillCard
                            key={bill.doc_entry}
                            bill={bill}
                            to={`/app/finance/bills/list/${bill.doc_entry}?search=${bill.bill_number}`}
                          />
                        ))}
                      </CardLayout>
                      <RouterButton
                        to={`/app/finance/bills/list${billsFilterUrl}`}
                        style="textRegular textXXS button buttonType4"
                        icon={CaretRightIcon}
                        name={`View all ${billsTotal} bill${billsTotal === 1 ? "" : "s"}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      />
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </CardLayout>

          {/* VENDOR PAYMENTS */}
          <CardLayout style="generalCard matchedSection cardPaddingSmall">
            <button
              type="button"
              className="salesOrderSidebarSectionToggle"
              onClick={() => setVendorPaymentsOpen((open) => !open)}
            >
              <MatchConnector label="Vendor Payments" icon={HandCoinsIcon} />
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
                  {vendorPaymentsLoading ? (
                    <LoadingIcon />
                  ) : vendorPaymentsError ? (
                    <NoResult title="Error loading vendor payments" />
                  ) : vendorPayments.length === 0 ? (
                    <NoResult title="No vendor payments found" />
                  ) : (
                    <>
                      <CardLayout style="cardLayout1 cardPaddingSmall cardGapSmall">
                        {vendorPayments.map((vendorPayment) => (
                          <VendorPaymentCard
                            key={vendorPayment.doc_entry}
                            vendorPayment={vendorPayment}
                            to={`/app/finance/bills/vendor-payments/${vendorPayment.doc_entry}?search=${vendorPayment.payment_number}`}
                          />
                        ))}
                      </CardLayout>
                      <RouterButton
                        to={`/app/finance/bills/vendor-payments${vendorPaymentsFilterUrl}`}
                        style="textRegular textXXS button buttonType4"
                        icon={CaretRightIcon}
                        name={`View all ${vendorPaymentsTotal} vendor payment${vendorPaymentsTotal === 1 ? "" : "s"}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      />
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </CardLayout>
        </>
      )}
    </div>
  );
}
