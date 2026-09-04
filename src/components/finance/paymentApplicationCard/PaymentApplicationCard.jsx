import { Link } from "react-router";
import StatusBox from "../../status/statusBox/StatusBox";

// Read-only card for one sap_payment_applications row. Unlike the other line
// cards, this one accepts a to -- but only once the application's doc_entry
// has been resolved to a real invoice (inv_type=13; see
// fetchPaymentApplications.js's enrichment), so it's only "live" when there's
// somewhere to link through to. Falls back to the raw Entry #/On Account
// display for anything that didn't resolve (on-account applications, or an
// inv_type this app doesn't extract the target table for).
export default function PaymentApplicationCard({ application, to }) {
  const amount = application.amount_applied_myr || 0;
  const invoice = application.invoice;

  const appliedToLabel = invoice
    ? `INV# ${invoice.invoice_number}`
    : application.inv_entry === 0
      ? "On Account"
      : `Entry #${application.inv_entry}`;

  const linkTo = invoice ? to : undefined;
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
