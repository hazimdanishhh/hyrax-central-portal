import StatusBox from "../../status/statusBox/StatusBox";
import CardLayout from "../../cardLayout/CardLayout";
import { formatDate } from "../../../functions/formatDate";
import IconCard from "../../iconCard/IconCard";
import { BankIcon, ClockIcon, PackageIcon } from "@phosphor-icons/react";
import StatusBadge from "../../status/statusBadge/StatusBadge";

export default function InvoiceLineCard({ line }) {
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
              icon={BankIcon}
              weight="fill"
              name={line.tax_pct ? `Tax %: ${line.tax_pct}` : "Tax %: —"}
              style="blue textXXXS textBold"
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
            <p className="textLight textXXS">
              <strong className="textBold">Cost Price (RM):</strong> RM{" "}
              {line.cost_price}
            </p>
            <p className="textLight textXXS">
              <strong className="textBold">Stock Price (RM):</strong> RM{" "}
              {line.stock_price}
            </p>
          </div>
        </div>
      </div>
    </button>
  );
}
