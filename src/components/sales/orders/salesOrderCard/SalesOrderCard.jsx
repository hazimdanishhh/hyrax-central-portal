import StatusBox from "../../../status/statusBox/StatusBox";
import CardLayout from "../../../cardLayout/CardLayout";
import { formatDate } from "../../../../functions/formatDate";
import "./SalesOrderCard.scss";
import IconCard from "../../../iconCard/IconCard";
import { ClockIcon } from "@phosphor-icons/react";
import StatusBadge from "../../../status/statusBadge/StatusBadge";
import EmployeeImage from "../../../employees/employeeImage/EmployeeImage";
import { useState } from "react";
import { motion } from "framer-motion";

// Read-only card for a sap_sales_orders row -- SAP is the system of record,
// so this only ever displays. status_code/gross_profit carry the same
// mapping/guard as the table this replaces (tableConfig.jsx's
// salesOrdersTableConfig): "O" -> Open (else Closed), and gross_profit is
// blanked out when it's implausible relative to the order total (a known
// SAP master-data defect, not a rendering choice).
//
// order.rep (sales_rep_code resolved to an employees_public row -- see
// salesOrdersService.js's fetchRepsByCode/attachRep) shows who owns this
// order. A plain <img>, not the EmployeeImage component -- EmployeeImage
// renders its own <Link>, and this whole card is already a single <button>,
// so nesting a Link inside it would be invalid interactive-inside-
// interactive markup. Same fallback path (default.webp) as
// EmployeeCard.jsx/ProjectMemberAvatarStack.jsx use for the identical
// "avatar inside an already-clickable card" situation.
function SalesOrderCard({ order, onClick }) {
  const isOpen = order.status_code === "O";
  const total = order.total_amount_myr || 0;
  const gp = order.gross_profit;
  const grossProfitDisplay =
    gp == null || Math.abs(gp) > Math.abs(total) * 5
      ? "—"
      : `RM ${Math.round(gp).toLocaleString()}`;
  const rep = order.rep;
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
            {order.is_cancelled === "Y" && (
              <StatusBox status="Cancelled" type="red" />
            )}
          </div>

          <div className="salesOrderCardHeaderDetails">
            <p className="textBold textXS">SO# {order.so_number}</p>

            <div className="salesOrderCustomer">
              <StatusBox status={order.customer_code} type="blue" />
              <p
                className="textLight textXXS truncate"
                title={order.customer_name}
              >
                {order.customer_name}
              </p>
            </div>

            <StatusBox
              status={
                order.customer_ref ? `PO: ${order.customer_ref}` : "PO: —"
              }
              type={order.customer_ref ? "green" : "grey"}
            />
          </div>
        </div>

        <div className="salesOrderCardRight">
          <div className="salesOrderCardDates">
            <IconCard
              icon={ClockIcon}
              weight="fill"
              name={
                order.order_date
                  ? `Order: ${formatDate(order.order_date)}`
                  : "—"
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
          </div>

          <div className="salesOrderCardHeaderDetails">
            <p className="textLight textXXS">
              <strong className="textBold">Total (RM):</strong> RM{" "}
              {Math.round(total).toLocaleString()}
            </p>
            <p className="textLight textXXS">
              <strong className="textBold">Gross Profit (RM):</strong>{" "}
              {grossProfitDisplay}
            </p>
            <div>
              <EmployeeImage
                showName={false}
                setShowName={() => {}}
                employee={rep}
                position="right"
                employeeId={order.rep?.id || "/"}
                displayName={order.rep?.full_name}
              />
            </div>
          </div>
        </div>
      </div>
    </motion.button>
  );
}

export default SalesOrderCard;
