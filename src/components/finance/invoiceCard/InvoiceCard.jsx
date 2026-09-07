import { formatDate } from "../../../functions/formatDate";
import "./InvoiceCard.scss";
import IconCard from "../../iconCard/IconCard";
import { ClockIcon } from "@phosphor-icons/react";
import StatusBadge from "../../status/statusBadge/StatusBadge";
import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router";
import StatusBox from "../../status/statusBox/StatusBox";
import CardLayout from "../../cardLayout/CardLayout";
import SalesRepBadge from "../../employees/salesRepBadge/SalesRepBadge";

const MotionLink = motion.create(Link);

export default function InvoiceCard({ invoice, to }) {
  const isOpen = invoice.status_code === "O";
  const total = invoice.total_amount_myr || 0;
  const paid = invoice.paid_to_date || 0;
  const gp = invoice.gross_profit;
  const grossProfitDisplay =
    gp == null || Math.abs(gp) > Math.abs(total) * 5
      ? "—"
      : `RM ${Math.round(gp).toLocaleString()}`;
  // invoice.rep is resolved server-side (see invoicesService.js's
  // fetchRepsByCode/attachRep, mirroring salesOrdersService.js's own) --
  // invoice.sales_rep_code itself is just the bare SAP code, never an
  // employee object.
  const rep = invoice.rep;
  const Wrapper = to ? MotionLink : motion.div;
  const wrapperProps = to
    ? {
        to,
        className: "generalCard salesOrderCard",
        initial: { y: 0 },
        whileHover: { y: -3 },
      }
    : { className: "generalCard salesOrderCard", initial: { y: 0 } };

  return (
    <Wrapper {...wrapperProps}>
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
            <SalesRepBadge rep={rep} repCode={invoice.sales_rep_code} />
          </div>
        </div>
      </div>
    </Wrapper>
  );
}
