import { BankIcon } from "@phosphor-icons/react";
import StatusBox from "../../status/statusBox/StatusBox";
import IconCard from "../../iconCard/IconCard";

// Read-only card for one sap_vendor_bill_lines row -- AP mirror of
// InvoiceLineCard. unit_of_measure is frequently NULL on this table (a real
// SAP data gap, not a rendering bug), so it's guarded the same way the other
// optional fields are.
export default function BillLineCard({ line }) {
  const total = line.line_total || 0;

  return (
    <button className="generalCard salesOrderCard">
      <div className="salesOrderCardHeader">
        <div className="salesOrderCardHeaderLeft">
          <div className="salesOrderStatus"></div>

          <div className="salesOrderCardHeaderDetails">
            <p className="textBold textXS"># {line.line_num}</p>

            <div className="salesOrderCustomer">
              <StatusBox status={line.item_code} type="blue" />
              <p
                className="textLight textXXS truncate"
                title={line.sap_items?.item_name || line.item_code}
              >
                {line.sap_items?.item_name || line.item_code}
              </p>
            </div>

            <StatusBox
              status={
                line.unit_of_measure
                  ? `${line.quantity} ${line.unit_of_measure}`
                  : `${line.quantity}`
              }
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
          </div>
        </div>
      </div>
    </button>
  );
}
