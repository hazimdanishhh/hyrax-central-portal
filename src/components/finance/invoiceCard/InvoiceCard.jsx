import { formatDate } from "../../../functions/formatDate";
import "./InvoiceCard.scss";
import IconCard from "../../iconCard/IconCard";
import { ClockIcon } from "@phosphor-icons/react";
import StatusBadge from "../../status/statusBadge/StatusBadge";
import EmployeeImage from "../../employees/employeeImage/EmployeeImage";
import { useState } from "react";
import { motion } from "framer-motion";
import StatusBox from "../../status/statusBox/StatusBox";
import CardLayout from "../../cardLayout/CardLayout";

export default function InvoiceCard({ invoice, onClick }) {
  const isOpen = invoice.status_code === "O";
  const total = invoice.total_amount_myr || 0;
  const paid = invoice.paid_to_date || 0;
  const gp = invoice.gross_profit;
  const grossProfitDisplay =
    gp == null || Math.abs(gp) > Math.abs(total) * 5
      ? "—"
      : `RM ${Math.round(gp).toLocaleString()}`;
  const rep = invoice.sales_rep_code;
  const repAvatarUrl = rep?.avatar_url || "/profilePhoto/default.webp";
  return (
    <motion.button
      className="generalCard salesOrderCard"
      onClick={onClick}
      initial={{ y: 0 }}
      whileHover={{ y: -3 }}
    >
      <div className="salesOrderCardHeader">
        <div className="salesOrderCardHeaderLeft">
          <div className="salesOrderStatus">
            <StatusBadge
              status={isOpen ? "Open" : "Closed"}
              type={isOpen ? "green" : "grey"}
            />
            {invoice.is_cancelled === "Y" && (
              <StatusBox status="Cancelled" type="red" />
            )}
          </div>

          <div className="salesOrderCardHeaderDetails">
            <p className="textBold textXS">INV# {invoice.invoice_number}</p>

            <div className="salesOrderCustomer">
              <StatusBox status={invoice.customer_code} type="blue" />
              <p
                className="textLight textXXS truncate"
                title={invoice.customer_name}
              >
                {invoice.customer_name}
              </p>
            </div>

            <StatusBox
              status={
                invoice.customer_ref ? `PO: ${invoice.customer_ref}` : "PO: —"
              }
              type={invoice.customer_ref ? "green" : "grey"}
            />
          </div>
        </div>

        <div className="salesOrderCardRight">
          <div className="salesOrderCardDates">
            <IconCard
              icon={ClockIcon}
              weight="fill"
              name={
                invoice.invoice_date
                  ? `Invoice: ${formatDate(invoice.invoice_date)}`
                  : "—"
              }
              style="blue textXXXS textBold"
            />
            <IconCard
              icon={ClockIcon}
              weight="fill"
              name={
                invoice.due_date ? `Due: ${formatDate(invoice.due_date)}` : "—"
              }
              style="yellow textXXXS textBold"
            />
          </div>

          <div className="salesOrderCardHeaderDetails">
            <p className="textLight textXXS">
              <strong className="textBold">Total (RM):</strong> RM{" "}
              {Math.round(total).toLocaleString()}
            </p>
            <p className="textLight textXXS">
              <strong className="textBold">Paid (RM):</strong> RM{" "}
              {Math.round(paid).toLocaleString()}
            </p>
            <p className="textLight textXXS">
              <strong className="textBold">Gross Profit (RM):</strong>{" "}
              {grossProfitDisplay}
            </p>
            <StatusBox
              status={`Tax: RM ${invoice.tax_amount ? invoice.tax_amount : "-"}`}
              type="yellow"
            />
            <div>
              <EmployeeImage
                showName={false}
                setShowName={() => {}}
                employee={rep}
                position="right"
                employeeId={invoice.sales_rep_code?.id || "/"}
                displayName={invoice.sales_rep_code?.full_name}
              />
            </div>
          </div>
        </div>
      </div>
    </motion.button>
  );
}
