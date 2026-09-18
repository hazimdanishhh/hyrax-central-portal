import { Link } from "react-router";
import StatusBox from "../../status/statusBox/StatusBox";

// Read-only card for one sap_payment_applications row. Unlike the other line
// cards, this one accepts a to -- but only once there's somewhere real to
// link through to: either the application's doc_entry resolved to a real
// invoice (inv_type=13; see fetchPaymentApplications.js's enrichment), or
// it's an "On Account" application (inv_entry === 0), in which case `to`
// (built by PaymentSidebar.jsx from the parent payment's own customer_code)
// points at that customer's Business Partner page instead. Falls back to
// the raw Entry # display for anything else that didn't resolve (an
// inv_type this app doesn't extract the target table for).
export default function PaymentApplicationCard({ application, to }) {
  const amount = application.amount_applied_myr || 0;
  const invoice = application.invoice;
  const isOnAccount = application.inv_entry === 0;

  const appliedToLabel = invoice
    ? `INV# ${invoice.invoice_number}`
    : isOnAccount
      ? "On Account"
      : `Entry #${application.inv_entry}`;

  const linkTo = invoice || isOnAccount ? to : undefined;
  const Wrapper = linkTo ? Link : "div";
  const wrapperProps = linkTo
    ? { to: linkTo, className: "generalCard salesOrderCard" }
    : { className: "generalCard salesOrderCard" };

  return (
    <Wrapper {...wrapperProps}>
      <div className="salesOrderCardHeader">
        <div className="salesOrderCardHeaderLeft">
          <div className="salesOrderCardHeaderDetails">
            <p className="textBold textXS">{appliedToLabel}</p>

            <StatusBox status={`Type: ${application.inv_type}`} type="blue" />
          </div>
        </div>

        <div className="salesOrderCardRight">
          <div className="salesOrderCardHeaderDetails">
            <p className="textLight textXXS">
              <strong className="textBold">Amount Applied (RM):</strong> RM{" "}
              {Math.round(amount).toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    </Wrapper>
  );
}
