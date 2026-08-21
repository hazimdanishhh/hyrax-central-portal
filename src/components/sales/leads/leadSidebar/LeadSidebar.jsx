import { useState } from "react";
import { useNavigate } from "react-router";
import EmployeeImage from "../../../employees/employeeImage/EmployeeImage";
import StatusBox from "../../../status/statusBox/StatusBox";
import "./LeadSidebar.scss";
import LeadStage from "../leadStage/LeadStage";
import useLeadMutations from "../../../../features/sales/leads/private/hooks/useLeadMutations";
import Button from "../../../buttons/button/Button";
import {
  LEAD_STAGE_LABELS,
  LEAD_STAGE_TRANSITIONS,
} from "../../../../pages/user/sales/leads/list/constants/leadStageTransitions";
import {
  BriefcaseIcon,
  CheckCircleIcon,
  ClockClockwiseIcon,
  ClockCounterClockwiseIcon,
  ClockIcon,
  DropIcon,
  FilePdfIcon,
  PauseCircleIcon,
  PencilSimpleLineIcon,
  PencilSimpleSlashIcon,
  PlayCircleIcon,
  ReceiptIcon,
  TextTIcon,
  XCircleIcon,
} from "@phosphor-icons/react";
import CardLayout from "../../../cardLayout/CardLayout";
import IconCard from "../../../iconCard/IconCard";
import RouterButton from "../../../buttons/routerButton/RouterButton";
import StatusIcon from "../../../status/statusIcon/StatusIcon";
import { useAccessControl } from "../../../../context/AccessControlContext";
import { useSalesOrdersByCustomerCode } from "../../../../features/sales/orders/private/hooks/useSalesOrdersByCustomerCode";
import { useSalesOrderByPoNumber } from "../../../../features/sales/orders/private/hooks/useSalesOrderByPoNumber";
import { salesOrdersTableConfig } from "../../../../pages/user/sales/orders/tableConfig";
import DataTable from "../../../dataTable/DataTable";
import NoResult from "../../../crud/noResult/NoResult";
import LoadingIcon from "../../../loadingIcon/LoadingIcon";
import DetailFieldGrid from "../../../dataSidebar/DetailFieldGrid";
import { formatDate } from "../../../../functions/formatDate";
import SalesOrderCard from "../../orders/salesOrderCard/SalesOrderCard";

export default function LeadSidebar({
  selectedRow,
  onRequestAction,
  updating,
  isEditing,
  setIsEditing,
}) {
  const [showName, setShowName] = useState(false);
  const { canAccess, isManager, isSuperAdmin } = useAccessControl();
  const navigate = useNavigate();

  // Account identity (2026-08): a lead references exactly one of a real SAP
  // customer or a native Prospect client, never both -- see
  // hyrax-central-portal/docs/DASHBOARD-ROADMAP.md §1.4. Related SAP orders
  // (moved here from the old Clients-page Orders tab) only ever apply to the
  // SAP-customer case -- a Prospect has no SAP relationship yet.
  const isSapLinked = Boolean(selectedRow.sap_customer_code);
  const accountName =
    selectedRow.client?.name || selectedRow.sap_customer?.customer_name;
  const {
    data: ordersResult,
    isLoading: ordersLoading,
    error: ordersError,
  } = useSalesOrdersByCustomerCode(selectedRow.sap_customer_code);
  const orders = ordersResult?.data ?? [];
  const orderColumns = salesOrdersTableConfig();

  // PO-number match (independent of the sap_customer_code lookup above) --
  // sales_leads.po_number (rep-typed at WON) against
  // sap_sales_orders.customer_ref (SAP NumAtCard). See
  // useSalesOrderByPoNumber.js for why this can resolve to 0, 1, or many rows.
  const {
    data: poMatchResult,
    isLoading: poMatchLoading,
    error: poMatchError,
  } = useSalesOrderByPoNumber(selectedRow.po_number);
  const matchedOrders = poMatchResult?.data ?? [];

  //   BOOLEANS
  const isWon = selectedRow.stage === "WON";
  const isLost = selectedRow.stage === "LOST";
  const isCancelled = selectedRow.is_cancelled;
  const isClosedLead = isWon || isLost || isCancelled;

  const canTransitionStage = !isClosedLead && !selectedRow.is_on_hold;

  const canToggleHold = !isClosedLead;

  const canCancel = !isWon && !isLost && !isCancelled;

  /**
   * Current allowed transitions
   */
  const allowedTransitions = LEAD_STAGE_TRANSITIONS[selectedRow.stage] || [];

  return (
    <div className="leadSidebarContainer">
      <div className="leadSidebarDateTimeContainer">
        <IconCard
          name={selectedRow.created_at}
          icon={ClockIcon}
          style="textLight textXXXS cardStyle"
        />
        <IconCard
          name={selectedRow.updated_at}
          icon={ClockClockwiseIcon}
          style="textLight textXXXS cardStyle"
        />
      </div>

      {/* PIPELINE */}
      <LeadStage selectedRow={selectedRow} vertical={true} />

      <div className="leadSidebarHeaderContainer cardStyle">
        <div className="leadSidebarDetails">
          {/* STATUS */}
          <div className="leadSidebarOnHoldContainer">
            <StatusBox
              status={selectedRow.stage}
              type={
                selectedRow.is_cancelled || selectedRow.stage === "LOST"
                  ? "red"
                  : selectedRow.is_on_hold
                    ? "yellow"
                    : "green"
              }
            />

            {selectedRow.is_on_hold && (
              <StatusBox status="ON HOLD" type="yellow" />
            )}
            {selectedRow.is_cancelled && (
              <StatusBox status="CANCELLED" type="red" />
            )}

            <StatusIcon
              status={selectedRow.product_type}
              icon={DropIcon}
              type="dark"
            />
          </div>

          <p className="textBold textS">{selectedRow.title}</p>

          <p className="textRegular textXS">{selectedRow.description}</p>

          <div className="leadSidebarOnHoldContainer">
            <IconCard
              name={accountName}
              icon={BriefcaseIcon}
              style="textLight textXS"
            />
            <StatusBox
              status={
                isSapLinked
                  ? `SAP Customer — ${selectedRow.sap_customer_code}`
                  : "Prospect"
              }
              type={isSapLinked ? "green" : "grey"}
            />
          </div>

          <CardLayout style="cardLayout2 cardGapSmall">
            <StatusBox
              status={`${selectedRow.close_probability}% Probability`}
              type={
                selectedRow.close_probability > 75
                  ? "green"
                  : selectedRow.close_probability < 40
                    ? "red"
                    : "yellow"
              }
            />
            <StatusBox
              status={`Expected: RM${selectedRow.expected_revenue}`}
              type="blue"
            />
            {selectedRow.actual_revenue && (
              <StatusBox
                status={`Actual: RM${selectedRow.actual_revenue}`}
                type="green"
              />
            )}
            {selectedRow.po_number && (
              <StatusBox
                status={`PO Number: ${selectedRow.po_number}`}
                type="yellow"
              />
            )}
          </CardLayout>

          <CardLayout style="cardLayout2 cardGapSmall">
            {selectedRow.quotation_url && (
              <a
                href={selectedRow.quotation_url}
                className="textLight textXXS button buttonType4"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="textLight textXXS">View Quotation</span>
                <FilePdfIcon size={24} />
              </a>
            )}
            {selectedRow.po_document_url && (
              <a
                href={selectedRow.po_document_url}
                className="textLight textXXS button buttonType4 approval"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="textLight textXXS">View PO</span>
                <FilePdfIcon size={24} />
              </a>
            )}
          </CardLayout>
        </div>

        {/* DATE TIME / IMAGE / HISTORY BUTTON */}
        <div className="leadSidebarImageContainer">
          <EmployeeImage
            employee={selectedRow.lead_owner}
            employeeId={selectedRow.lead_owner?.id}
            showName={showName}
            setShowName={setShowName}
            position="left"
          />

          {/* <RouterButton
            name="History"
            icon={ClockCounterClockwiseIcon}
            style="button buttonType5 textXXXS"
          /> */}
        </div>
      </div>

      {/* NOTES */}
      {selectedRow.notes && (
        <CardLayout style="generalCard blueCard">
          <p className="textBold textXS">Notes:</p>
          <p className="textRegular textXXS">{selectedRow.notes}</p>
        </CardLayout>
      )}

      {/* HOLD REASON */}
      {selectedRow.hold_reason && (
        <CardLayout style="generalCard yellowCard">
          <p className="textBold textXS">Hold Reason:</p>
          <p className="textRegular textXXS">{selectedRow.hold_reason}</p>
        </CardLayout>
      )}

      {/* CANCEL REASON */}
      {selectedRow.cancel_reason && (
        <CardLayout style="generalCard redCard">
          <p className="textBold textXS">Cancel Reason:</p>
          <p className="textRegular textXXS">{selectedRow.cancel_reason}</p>
        </CardLayout>
      )}

      {/* LOST REASON */}
      {selectedRow.lose_reason_id && (
        <CardLayout style="generalCard redCard">
          <p className="textBold textXS">Lose Reason:</p>
          <p className="textRegular textXXS">{selectedRow.lose_reason?.name}</p>
        </CardLayout>
      )}

      {/* MATCHED SAP SALES ORDER -- live lookup only, sales_leads.po_number
          (rep-typed at WON) matched against sap_sales_orders.customer_ref
          (SAP NumAtCard). No persisted bridge -- see
          docs/DASHBOARD-ROADMAP.md §1.3 for the larger, not-yet-built
          persisted version of this idea. Each matched card deep-links
          straight to that order's own detail page (2026-08, mirrors Sales
          Leads' own :leadId URL pattern -- see Orders.jsx/SalesRoutes.jsx),
          gated the same as the "View in Sales Orders" link below, which is
          only shown to users who'd actually pass that route's own access
          check (SalesRoutes.jsx: departments=["SAL"], no role restriction
          since 2026-08 -- everyone else still sees the inline match
          summary, just without a way to click through to the raw order). */}
      {selectedRow.po_number && (
        <CardLayout style="generalCard cardPaddingSmall">
          <IconCard
            name={`Matched Sales Order — PO ${selectedRow.po_number}`}
            icon={ReceiptIcon}
            style="textBold textXS"
          />

          {poMatchLoading ? (
            <LoadingIcon />
          ) : poMatchError ? (
            <NoResult title="Error checking for a matching order" />
          ) : matchedOrders.length === 0 ? (
            <NoResult title="No SAP sales order found yet for this PO" />
          ) : (
            <>
              {matchedOrders.length > 1 && (
                <p className="textRegular textXXS">
                  {matchedOrders.length} sales orders share this PO number —
                  verify manually.
                </p>
              )}

              <CardLayout style="cardLayout1 cardPaddingSmall cardGapSmall">
                {matchedOrders.map((order) => (
                  <SalesOrderCard
                    key={order.doc_entry}
                    order={order}
                    onClick={
                      canAccess({ departments: ["SAL"] })
                        ? () =>
                            navigate(
                              `/app/sales/orders/all/${order.doc_entry}?search=${order.so_number}`,
                            )
                        : undefined
                    }
                  />
                ))}
              </CardLayout>

              {/* {canAccess({ departments: ["SAL"] }) && (
                <RouterButton
                  to={`/app/sales/orders/all?search=${encodeURIComponent(selectedRow.po_number)}`}
                  name="View in Sales Orders"
                  icon={ReceiptIcon}
                  style="button buttonType4 textXXS"
                />
              )} */}
            </>
          )}
        </CardLayout>
      )}

      {/* ACTIONS */}

      {selectedRow.stage === "NEGOTIATION" && canTransitionStage && (
        <Button
          name="Edit Quotation"
          icon={PencilSimpleLineIcon}
          style="button buttonType4 mobile"
          disabled={updating}
          onClick={() =>
            onRequestAction({
              type: "edit_quotation",
              payload: {
                id: selectedRow.id,
                quotation_url: selectedRow.quotation_url, // Pass existing URL to pre-fill if needed
              },
            })
          }
        />
      )}

      <div className="cardLayout2">
        {/* STAGE TRANSITIONS */}
        {canTransitionStage &&
          allowedTransitions.map((stage) => (
            <Button
              key={stage}
              name={LEAD_STAGE_LABELS[stage]}
              icon={
                LEAD_STAGE_LABELS[stage] === "Mark as Lost"
                  ? XCircleIcon
                  : LEAD_STAGE_LABELS[stage] === "Mark as Won"
                    ? CheckCircleIcon
                    : PlayCircleIcon
              }
              style={
                LEAD_STAGE_LABELS[stage] === "Mark as Lost"
                  ? "button buttonType4 rejection mobile"
                  : "button buttonType4 approval mobile"
              }
              disabled={updating || isClosedLead || selectedRow.is_on_hold}
              onClick={() =>
                onRequestAction({
                  type: "stage_change",
                  payload: {
                    id: selectedRow.id,
                    stage,
                  },
                })
              }
            />
          ))}
      </div>

      <CardLayout style="cardLayout2">
        {/* HOLD / RESUME */}
        {canToggleHold && (
          <Button
            icon={selectedRow.is_on_hold ? PlayCircleIcon : PauseCircleIcon}
            name={selectedRow.is_on_hold ? "Resume" : "Hold"}
            style="button buttonType4 yellow mobile"
            disabled={updating}
            onClick={() =>
              onRequestAction({
                type: "toggle_hold",
                payload: {
                  id: selectedRow.id,
                  is_on_hold: !selectedRow.is_on_hold,
                },
              })
            }
          />
        )}

        {/* CANCEL */}
        {canCancel && (
          <Button
            icon={XCircleIcon}
            name="Cancel"
            style="button buttonType4 rejection mobile"
            disabled={updating}
            onClick={() =>
              onRequestAction({
                type: "cancel",
                payload: {
                  id: selectedRow.id,
                  is_cancelled: true,
                },
              })
            }
          />
        )}
      </CardLayout>

      {/* EDIT BUTTON */}
      {!isClosedLead && (
        <Button
          name="Edit"
          icon={PencilSimpleLineIcon}
          style="button buttonType4 textXS"
          size={16}
          onClick={() => setIsEditing(!isEditing)}
        />
      )}
    </div>
  );
}
