import { ClockIcon } from "@phosphor-icons/react";
import { formatDate } from "../../../functions/formatDate";
import StatusBox from "../../status/statusBox/StatusBox";
import StatusBadge from "../../status/statusBadge/StatusBadge";
import IconCard from "../../iconCard/IconCard";

// Read-only card for a sap_vendor_bills row -- AP mirror of InvoiceCard. No
// rep/employee avatar -- bills have no sales-rep concept. vendor_ref (SAP
// NumAtCard) is the AP mirror of Invoice/Order's customer_ref, shown the
// same way as a "PO: ..." badge for parity, even though it isn't surfaced
// in billsTableConfig.jsx.
export default function BillCard({ bill, onClick }) {
  const isOpen = bill.status_code === "O";
  const total = bill.total_amount_myr || 0;
  const paid = bill.paid_to_date || 0;
  const outstanding = total - paid;

  return (
    <button className="generalCard salesOrderCard" onClick={onClick}>
      <div className="salesOrderCardHeader">
        <div className="salesOrderCardHeaderLeft">
          <div className="salesOrderStatus">
            <StatusBadge
              status={isOpen ? "Open" : "Closed"}
              type={isOpen ? "green" : "grey"}
            />
            {bill.is_cancelled === "Y" && (
              <StatusBox status="Cancelled" type="red" />
            )}
          </div>

          <div className="salesOrderCardHeaderDetails">
            <p className="textBold textXS">BILL# {bill.bill_number}</p>

            <div className="salesOrderCustomer">
              <StatusBox status={bill.vendor_code} type="blue" />
              <p
                className="textLight textXXS truncate"
                title={bill.vendor_name}
              >
                {bill.vendor_name}
              </p>
            </div>

            <StatusBox
              status={bill.vendor_ref ? `PO: ${bill.vendor_ref}` : "PO: —"}
              type={bill.vendor_ref ? "green" : "grey"}
            />
          </div>
        </div>

        <div className="salesOrderCardRight">
          <div className="salesOrderCardDates">
            <IconCard
              icon={ClockIcon}
              weight="fill"
              name={
                bill.bill_date ? `Bill: ${formatDate(bill.bill_date)}` : "—"
              }
              style="blue textXXXS textBold"
            />
            <IconCard
              icon={ClockIcon}
              weight="fill"
              name={bill.due_date ? `Due: ${formatDate(bill.due_date)}` : "—"}
              style="yellow textXXXS textBold"
            />
          </div>

          <div className="salesOrderCardHeaderDetails">
            <p className="textLight textXXS">
              <strong className="textBold">Total (RM):</strong> RM{" "}
              {Math.round(total).toLocaleString()}
            </p>
            <p className="textLight textXXS">
              <strong className="textBold">Outstanding (RM):</strong> RM{" "}
              {Math.round(outstanding).toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    </button>
  );
}
