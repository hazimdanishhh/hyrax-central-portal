import { ClockIcon } from "@phosphor-icons/react";
import { Link } from "react-router";
import { formatDate } from "../../../functions/formatDate";
import StatusBox from "../../status/statusBox/StatusBox";
import StatusBadge from "../../status/statusBadge/StatusBadge";
import IconCard from "../../iconCard/IconCard";
import CardLayout from "../../cardLayout/CardLayout";
import SAPCustomerCard from "../../client/sapCustomerCard/SAPCustomerCard";
import { getBalanceTone } from "../../../functions/documentFigureTone";

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
      <div className="documentCardHeader">
        <div className="documentCardStatus">
          <StatusBadge
            status={isActive ? "Active" : "Cancelled"}
            type={isActive ? "green" : "red"}
          />
        </div>

        <div className="documentCardDates">
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
      </div>

      <CardLayout style="cardLayout2">
        <p className="textBold textXS">RCT# {payment.receipt_number}</p>

        <StatusBox
          status={payment.reference ? `Ref: ${payment.reference}` : "Ref: —"}
          type={payment.reference ? "green" : "grey"}
        />

        <SAPCustomerCard row={payment} nestedLink={!to} />
      </CardLayout>

      <div className="documentCardFigures cardLayout2 cardGapSmall cardLayoutMin2">
        <p className="textLight textXXS">
          <strong className="textBold">Total:</strong> RM{" "}
          {Math.round(total).toLocaleString()}
        </p>
        <p className={`textLight textXXS ${getBalanceTone(unallocated)}`}>
          <strong className="textBold">Unallocated:</strong> RM{" "}
          {Math.round(unallocated).toLocaleString()}
        </p>
      </div>
    </Wrapper>
  );
}
