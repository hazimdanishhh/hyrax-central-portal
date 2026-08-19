import StatusBox from "../../../status/statusBox/StatusBox";
import CardLayout from "../../../cardLayout/CardLayout";
import { formatDate } from "../../../../functions/formatDate";
import "./SalesOrderLineCard.scss";
import IconCard from "../../../iconCard/IconCard";
import { ClockIcon, PackageIcon } from "@phosphor-icons/react";
import StatusBadge from "../../../status/statusBadge/StatusBadge";

export default function SalesOrderLineCard({ line }) {
  const total = line.line_total || 0;

  return (
    <button className="generalCard salesOrderCard">
      <div className="salesOrderCardHeader">
        <div className="salesOrderCardHeaderLeft">
          <div className="salesOrderStatus">
            {/* <StatusBadge
              status={isOpen ? "Open" : "Closed"}
              type={isOpen ? "green" : "grey"}
            /> */}
            {/* {line.is_cancelled === "Y" && (
              <StatusBox status="Cancelled" type="red" />
            )} */}
          </div>

          <div className="salesOrderCardHeaderDetails">
            <p className="textBold textXS"># {line.line_num}</p>

            <div className="salesOrderCustomer">
              <StatusBox status={line.item_code} type="blue" />
              <p
                className="textLight textXXS truncate"
                title={line.description}
              >
                {line.description}
              </p>
            </div>

            <StatusBox
              status={`${line.quantity} ${line.unit_of_measure}`}
              type="green"
            />
          </div>
        </div>

        <div className="salesOrderCardRight">
          <div className="salesOrderCardDates">
            <IconCard
              icon={PackageIcon}
              weight="fill"
              name={
                line.open_qty ? `Open QTY: ${line.open_qty}` : "Open QTY: —"
              }
              style="blue textXXXS textBold"
            />
            <IconCard
              icon={PackageIcon}
              weight="fill"
              name={
                line.delivered_qty
                  ? `Delivered QTY: ${line.delivered_qty}`
                  : "Delivered QTY: —"
              }
              style="yellow textXXXS textBold"
            />
          </div>

          <div className="salesOrderCardHeaderDetails">
            <p className="textLight textXXS">
              <strong className="textBold">Line Total (RM):</strong> RM{" "}
              {Math.round(total).toLocaleString()}
            </p>
            <p className="textLight textXXS">
              <strong className="textBold">Unit Price (RM):</strong> RM{" "}
              {line.unit_price}
            </p>
          </div>
        </div>
      </div>
    </button>
  );
}
