import { formatDate } from "../../../functions/formatDate";
import { getDocumentStageSummary } from "../../../functions/documentStageSummary";
import {
  getAmountTone,
  getBalanceTone,
  getMarginTone,
} from "../../../functions/documentFigureTone";
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
import SAPCustomerCard from "../../client/sapCustomerCard/SAPCustomerCard";

const MotionLink = motion.create(Link);

export default function InvoiceCard({ invoice, to }) {
  const isOpen = invoice.status_code === "O";
  const total = invoice.total_amount_myr || 0;
  const paid = invoice.paid_to_date || 0;
  // Sourced from sap_invoices_with_balance (see
  // finance_outstanding_balance_views.sql) wherever the row came through
  // fetchInvoices/fetchInvoiceByDocEntry -- falls back to the identical
  // inline formula for any other fetch path so this never breaks, just
  // stops being the single source of truth for that one path.
  const outstanding = invoice.outstanding_balance ?? total - paid;
  // Sum of this invoice's own ACTIVE (non-cancelled) sap_payment_applications
  // rows -- a second, independently-sourced "how much is paid" figure,
  // deliberately kept separate from `paid` (SAP's own OINV.PaidToDate).
  // These two can legitimately disagree (see the view's own header comment
  // for why) -- the mismatch badge below exists to surface that gap
  // instead of hiding it, since it usually means paid_to_date hasn't
  // caught up with a payment application that landed after this invoice's
  // header last synced.
  const appliedPayment = invoice.applied_payment_myr ?? 0;
  // Sourced from the same view's has_paid_mismatch column (also what the
  // new paidMismatchOnly filter matches on) -- falls back to the identical
  // inline comparison for any fetch path that doesn't include it.
  const paidAppliedMismatch =
    invoice.has_paid_mismatch ?? Math.abs(paid - appliedPayment) > 0.01;
  // One coherent stage badge (Paid/Overdue/Due Soon/Open, mismatch layered
  // in) instead of separate status/mismatch facts the reader had to combine
  // themselves -- see documentStageSummary.js's own header comment.
  const stageSummary = getDocumentStageSummary({
    isCancelled: invoice.is_cancelled === "Y",
    outstanding,
    dueDate: invoice.due_date,
    hasPaidMismatch: paidAppliedMismatch,
  });
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
      <div className="documentCardHeader">
        <div className="documentCardStatus">
          <StatusBadge
            status={isOpen ? "Open" : "Closed"}
            type={isOpen ? "green" : "grey"}
          />
          <StatusBox status={stageSummary.stage} type={stageSummary.tone} />
        </div>

        <div className="documentCardDates">
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
      </div>

      <CardLayout style="cardLayout2">
        <p className="textBold textXS">INV# {invoice.invoice_number}</p>

        <p className="textBold textXS">PO# {invoice.customer_ref || `—`}</p>

        <SAPCustomerCard row={invoice} nestedLink={!to} />

        <SalesRepBadge rep={rep} repCode={invoice.sales_rep_code} />
      </CardLayout>

      <div className="documentCardFigures cardLayout2 cardGapSmall cardLayoutMin2">
        <p className="textLight textXXS">
          <strong className="textBold">Total:</strong> RM{" "}
          {Math.round(total).toLocaleString()}
        </p>
        <p className={`textLight textXXS ${getAmountTone(paid, total)}`}>
          <strong className="textBold">Paid:</strong> RM{" "}
          {Math.round(paid).toLocaleString()}
        </p>
        <p className={`textLight textXXS ${getBalanceTone(outstanding)}`}>
          <strong className="textBold">Outstanding:</strong> RM{" "}
          {Math.round(outstanding).toLocaleString()}
        </p>
        <p
          className={`textLight textXXS ${getAmountTone(appliedPayment, total)}`}
        >
          <strong className="textBold">Applied Payment:</strong> RM{" "}
          {Math.round(appliedPayment).toLocaleString()}
        </p>
        <p className={`textLight textXXS ${getMarginTone(gp, total)}`}>
          <strong className="textBold">Gross Profit:</strong>{" "}
          {grossProfitDisplay}
        </p>
        <p className="textLight textXXS">
          <strong className="textBold">Tax:</strong> RM{" "}
          {invoice.tax_amount ? invoice.tax_amount : "-"}
        </p>
      </div>
    </Wrapper>
  );
}
