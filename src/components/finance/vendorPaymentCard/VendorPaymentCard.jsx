import { ClockIcon } from "@phosphor-icons/react";
import { Link } from "react-router";
import { formatDate } from "../../../functions/formatDate";
import StatusBox from "../../status/statusBox/StatusBox";
import StatusBadge from "../../status/statusBadge/StatusBadge";
import IconCard from "../../iconCard/IconCard";

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
      <div className="salesOrderCardHeader">
        <div className="salesOrderCardHeaderLeft">
          <div className="salesOrderStatus">
            <StatusBadge
              status={isActive ? "Active" : "Cancelled"}
              type={isActive ? "green" : "red"}
            />
          </div>

          <div className="salesOrderCardHeaderDetails">
            <p className="textBold textXS">
              PMT# {vendorPayment.payment_number}
            </p>

            <div className="salesOrderCustomer">
              <StatusBox status={vendorPayment.vendor_code} type="blue" />
              <p
                className="textLight textXXS truncate"
                title={vendorPayment.vendor_name}
              >
                {vendorPayment.vendor_name}
              </p>
            </div>

            <StatusBox
              status={
                vendorPayment.reference
                  ? `Ref: ${vendorPayment.reference}`
                  : "Ref: —"
              }
              type={vendorPayment.reference ? "green" : "grey"}
            />
          </div>
        </div>

        <div className="salesOrderCardRight">
          <div className="salesOrderCardDates">
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
