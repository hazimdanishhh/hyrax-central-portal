import { ClockIcon } from "@phosphor-icons/react";
import { Link } from "react-router";
import { formatDate } from "../../../functions/formatDate";
import StatusBox from "../../status/statusBox/StatusBox";
import StatusBadge from "../../status/statusBadge/StatusBadge";
import IconCard from "../../iconCard/IconCard";
import CardLayout from "../../cardLayout/CardLayout";
import SAPVendorCard from "../../client/sapVendorCard/SAPVendorCard";
import { getBalanceTone } from "../../../functions/documentFigureTone";

// Read-only card for a sap_vendor_payments row -- AP mirror of PaymentCard.
export default function VendorPaymentCard({ vendorPayment, to }) {
  const isActive = vendorPayment.is_cancelled !== "Y";
  const total = vendorPayment.total_amount_myr || 0;
  const unallocated = vendorPayment.unallocated_amount || 0;
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
              vendorPayment.payment_date
                ? `Payment: ${formatDate(vendorPayment.payment_date)}`
                : "—"
            }
            style="blue textXXXS textBold"
          />
        </div>
      </div>

      <CardLayout style="cardLayout2">
        <p className="textBold textXS">PMT# {vendorPayment.payment_number}</p>

        <p className="textBold textXS">REF# {vendorPayment.reference || `—`}</p>

        <SAPVendorCard row={vendorPayment} nestedLink={!to} />
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
