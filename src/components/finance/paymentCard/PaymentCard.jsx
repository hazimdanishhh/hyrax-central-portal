import { ClockIcon } from "@phosphor-icons/react";
import { Link } from "react-router";
import { formatDate } from "../../../functions/formatDate";
import StatusBox from "../../status/statusBox/StatusBox";
import StatusBadge from "../../status/statusBadge/StatusBadge";
import IconCard from "../../iconCard/IconCard";

// Read-only card for a sap_payments row. No rep/employee avatar and no
// PO/customer_ref field on this entity -- reference fills the badge slot
// InvoiceCard/SalesOrderCard use for the PO number instead.
export default function PaymentCard({ payment, to }) {
  const isActive = payment.is_cancelled !== "Y";
  const total = payment.total_amount_myr || 0;
  const unallocated = payment.unallocated_amount || 0;
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
              status={isActive ? "Active" : "Cancelled"}
              type={isActive ? "green" : "red"}
            />
          </div>

          <div className="salesOrderCardHeaderDetails">
            <p className="textBold textXS">RCT# {payment.receipt_number}</p>

            <div className="salesOrderCustomer">
              <StatusBox status={payment.customer_code} type="blue" />
              <p
                className="textLight textXXS truncate"
                title={payment.customer_name}
              >
                {payment.customer_name}
              </p>
            </div>

            <StatusBox
              status={
                payment.reference ? `Ref: ${payment.reference}` : "Ref: —"
              }
              type={payment.reference ? "green" : "grey"}
            />
          </div>
        </div>

        <div className="salesOrderCardRight">
          <div className="salesOrderCardDates">
            <IconCard
              icon={ClockIcon}
              weight="fill"
              name={
                payment.payment_date
                  ? `Payment: ${formatDate(payment.payment_date)}`
                  : "—"
              }
              style="blue textXXXS textBold"
            />
          </div>

          <div className="salesOrderCardHeaderDetails">
            <p className="textLight textXXS">
              <strong className="textBold">Total (RM):</strong> RM{" "}
              {Math.round(total).toLocaleString()}
            </p>
            <p className="textLight textXXS">
              <strong className="textBold">Unallocated (RM):</strong> RM{" "}
              {Math.round(unallocated).toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    </Wrapper>
  );
}
