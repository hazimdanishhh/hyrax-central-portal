import StatusBox from "../../../status/statusBox/StatusBox";
import CardLayout from "../../../cardLayout/CardLayout";
import { formatDate } from "../../../../functions/formatDate";
import "./SalesOrderCard.scss";
import IconCard from "../../../iconCard/IconCard";
import { ClockIcon } from "@phosphor-icons/react";

// Read-only card for a sap_sales_orders row -- SAP is the system of record,
// so this only ever displays. status_code/gross_profit carry the same
// mapping/guard as the table this replaces (tableConfig.jsx's
// salesOrdersTableConfig): "O" -> Open (else Closed), and gross_profit is
// blanked out when it's implausible relative to the order total (a known
// SAP master-data defect, not a rendering choice).
function SalesOrderCard({ order, onClick }) {
  const isOpen = order.status_code === "O";
  const total = order.total_amount_myr || 0;
  const gp = order.gross_profit;
  const grossProfitDisplay =
    gp == null || Math.abs(gp) > Math.abs(total) * 5
      ? "—"
      : `RM ${Math.round(gp).toLocaleString()}`;

  return (
    <button className="generalCard salesOrderCard" onClick={onClick}>
      <div className="salesOrderCardHeader">
        <StatusBox
          status={isOpen ? "Open" : "Closed"}
          type={isOpen ? "green" : "grey"}
        />
        <div className="salesOrderCardHeaderCode">
          <p className="textBold textXS">SO# {order.so_number}</p>
          <p className="textLight textXXS">{order.customer_name}</p>
        </div>
      </div>

      <CardLayout style="cardLayout2 cardGapSmall">
        <IconCard
          icon={ClockIcon}
          weight="fill"
          name={
            order.order_date ? `Order: ${formatDate(order.order_date)}` : "—"
          }
          style="blue textXXXS textBold"
        />
        <IconCard
          icon={ClockIcon}
          weight="fill"
          name={
            order.delivery_date
              ? `Delivery: ${formatDate(order.delivery_date)}`
              : "—"
          }
          style="yellow textXXXS textBold"
        />

        <p className="textLight textXXS">
          <strong className="textBold">Total (RM):</strong> RM{" "}
          {Math.round(total).toLocaleString()}
        </p>
        <p className="textLight textXXS">
          <strong className="textBold">Gross Profit (RM):</strong>{" "}
          {grossProfitDisplay}
        </p>

        <StatusBox
          status={
            order.customer_ref
              ? `Customer PO: ${order.customer_ref}`
              : "Customer PO: —"
          }
          type="green"
        />
      </CardLayout>
    </button>
  );
}

export default SalesOrderCard;
