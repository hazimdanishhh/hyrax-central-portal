import StatusBox from "../../status/statusBox/StatusBox";

// Read-only card for one sap_vendor_payment_applications row -- AP mirror of
// PaymentApplicationCard. Resolved via fetchVendorPaymentApplications.js's
// enrichment (doc_type=18 -> sap_vendor_bills). Falls back to the raw
// Entry #/On Account display for anything that didn't resolve.
export default function VendorPaymentApplicationCard({
  application,
  onClick,
}) {
  const amount = application.amount_applied_myr || 0;
  const bill = application.bill;

  const appliedToLabel = bill
    ? `BILL# ${bill.bill_number}`
    : application.inv_entry === 0
      ? "On Account"
      : `Entry #${application.inv_entry}`;

  return (
    <button
      className="generalCard salesOrderCard"
      onClick={bill ? onClick : undefined}
    >
      <div className="salesOrderCardHeader">
        <div className="salesOrderCardHeaderLeft">
          <div className="salesOrderCardHeaderDetails">
            <p className="textBold textXS">{appliedToLabel}</p>

            <StatusBox status={`Type: ${application.doc_type}`} type="blue" />
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
    </button>
  );
}
