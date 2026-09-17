import { ClockIcon } from "@phosphor-icons/react";
import { Link } from "react-router";
import { formatDate } from "../../../functions/formatDate";
import StatusBox from "../../status/statusBox/StatusBox";
import StatusBadge from "../../status/statusBadge/StatusBadge";
import IconCard from "../../iconCard/IconCard";

// Read-only card for a sap_vendor_bills row -- AP mirror of InvoiceCard. No
// rep/employee avatar -- bills have no sales-rep concept. vendor_ref (SAP
// NumAtCard) is the AP mirror of Invoice/Order's customer_ref, shown the
// same way as a "PO: ..." badge for parity, even though it isn't surfaced
// in billsTableConfig.jsx.
export default function BillCard({ bill, to }) {
  const isOpen = bill.status_code === "O";
  const total = bill.total_amount_myr || 0;
  const paid = bill.paid_to_date || 0;
  // Sourced from sap_vendor_bills_with_balance (see
  // finance_outstanding_balance_views.sql) wherever the row came through
  // fetchBills/fetchBillByDocEntry -- falls back to the identical inline
  // formula for any other fetch path so this never breaks, just stops being
  // the single source of truth for that one path.
  const outstanding = bill.outstanding_balance ?? total - paid;
  // Sum of this bill's own ACTIVE (non-cancelled) sap_vendor_payment_
  // applications rows -- see InvoiceCard.jsx's own comment for why this is
  // kept separate from `paid` (OPCH.PaidToDate) rather than blended in, and
  // why the mismatch badge below exists.
  const appliedPayment = bill.applied_payment_myr ?? 0;
  const paidAppliedMismatch = Math.abs(paid - appliedPayment) > 0.01;
  const Wrapper = to ? Link : "div";
  const wrapperProps = to
    ? { to, className: "generalCard salesOrderCard" }
    : { className: "generalCard salesOrderCard" };

  return (
    <Wrapper {...wrapperProps}>
      <div className="salesOrderCardHeader">
        <div className="salesOrderCardHeaderLeft">
          <div className="salesOrderStatus">
            <StatusBadge
              status={isOpen ? "Open" : "Closed"}
              type={isOpen ? "green" : "grey"}
            />
            {bill.is_cancelled === "Y" && (
              <StatusBox status="Cancelled" type="red" />
            )}
          </div>

          <div className="salesOrderCardHeaderDetails">
            <p className="textBold textXS">BILL# {bill.bill_number}</p>

            <div className="salesOrderCustomer">
              <StatusBox status={bill.vendor_code} type="blue" />
              <p
                className="textLight textXXS truncate"
                title={bill.vendor_name}
              >
                {bill.vendor_name}
              </p>
            </div>

            <StatusBox
              status={bill.vendor_ref ? `PO: ${bill.vendor_ref}` : "PO: —"}
              type={bill.vendor_ref ? "green" : "grey"}
            />
          </div>
        </div>

        <div className="salesOrderCardRight">
          <div className="salesOrderCardDates">
            <IconCard
              icon={ClockIcon}
              weight="fill"
              name={
                bill.bill_date ? `Bill: ${formatDate(bill.bill_date)}` : "—"
              }
              style="blue textXXXS textBold"
            />
            <IconCard
              icon={ClockIcon}
              weight="fill"
              name={bill.due_date ? `Due: ${formatDate(bill.due_date)}` : "—"}
              style="yellow textXXXS textBold"
            />
          </div>

          <div className="salesOrderCardHeaderDetails">
            <p className="textLight textXXS">
              <strong className="textBold">Total (RM):</strong> RM{" "}
              {Math.round(total).toLocaleString()}
            </p>
            <p className="textLight textXXS">
              <strong className="textBold">Outstanding (RM):</strong> RM{" "}
              {Math.round(outstanding).toLocaleString()}
            </p>
            <p className="textLight textXXS">
              <strong className="textBold">Applied Payment (RM):</strong> RM{" "}
              {Math.round(appliedPayment).toLocaleString()}
            </p>
            {paidAppliedMismatch && (
              <StatusBox status="Paid ≠ Applied" type="red" />
            )}
          </div>
        </div>
      </div>
    </Wrapper>
  );
}
