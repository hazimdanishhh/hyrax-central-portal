import { TruckIcon } from "@phosphor-icons/react";
import { compactCurrency } from "../../functions/formatNumber";
import StatusBox from "../status/statusBox/StatusBox";
import "./FulfillmentSummaryCard.scss";
import SectionHeader from "../sectionHeader/SectionHeader";
import PageHeader from "../crud/pageHeader/PageHeader";
import LoadingIcon from "../loadingIcon/LoadingIcon";
import CardLayout from "../cardLayout/CardLayout";

function FulfillmentSummaryCard({
  isFullyDelivered,
  deliveryRecordCount,
  matchedInvoiceCount,
  totalInvoiced,
  totalPaid,
  totalApplied,
  totalOutstanding,
  hasPaidMismatch,
  isFullyPaid,
  fulfillmentLoading,
}) {
  return (
    <CardLayout style="generalCard">
      <PageHeader>
        <SectionHeader icon={TruckIcon} title="Fulfillment Summary" />

        <div className="fulfillmentSummaryStatus">
          {hasPaidMismatch && (
            <StatusBox status="Paid ≠ Applied (order total)" type="red" />
          )}
          {isFullyPaid && <StatusBox status="Fully Paid" type="green" />}
        </div>
      </PageHeader>

      {fulfillmentLoading ? (
        <LoadingIcon />
      ) : (
        <div className="fulfillmentSummaryCard cardLayout2 cardGapSmall">
          <p className="textLight textXXS">
            <strong className="textBold">Delivered:</strong>{" "}
            {isFullyDelivered ? "Fully Delivered" : "In Progress"}
            {deliveryRecordCount > 0 &&
              ` (${deliveryRecordCount} delivery record${deliveryRecordCount === 1 ? "" : "s"} on file)`}
          </p>
          <p className="textLight textXXS">
            <strong className="textBold">Matched Invoices:</strong>{" "}
            {matchedInvoiceCount}
          </p>
          <p className="textLight textXXS">
            <strong className="textBold">Total Invoiced (RM):</strong>{" "}
            {compactCurrency(totalInvoiced)}
          </p>
          <p className="textLight textXXS">
            <strong className="textBold">Total Paid (RM):</strong>{" "}
            {compactCurrency(totalPaid)}
          </p>
          <p className="textLight textXXS">
            <strong className="textBold">Total Applied Payment (RM):</strong>{" "}
            {compactCurrency(totalApplied)}
          </p>
          <p className="textLight textXXS">
            <strong className="textBold">Total Outstanding (RM):</strong>{" "}
            {compactCurrency(totalOutstanding)}
          </p>
        </div>
      )}
    </CardLayout>
  );
}

export default FulfillmentSummaryCard;
