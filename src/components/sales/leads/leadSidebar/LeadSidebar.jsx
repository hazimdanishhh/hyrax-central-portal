import { useState } from "react";
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
  PauseCircleIcon,
  PencilSimpleLineIcon,
  PlayCircleIcon,
  TextTIcon,
  UserCircleIcon,
  XCircleIcon,
} from "@phosphor-icons/react";
import CardLayout from "../../../cardLayout/CardLayout";
import IconCard from "../../../iconCard/IconCard";

export default function LeadSidebar({
  selectedRow,
  onRequestAction,
  updating,
  isEditing,
  setIsEditing,
}) {
  const [showName, setShowName] = useState(false);

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
      <div className="leadSidebarHeaderContainer">
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
          </div>

          <p className="textBold textS">{selectedRow.title}</p>

          <p className="textRegular textXS">{selectedRow.description}</p>

          <IconCard
            name={selectedRow.client?.name}
            icon={BriefcaseIcon}
            style="textLight textXS"
          />

          <IconCard
            name={selectedRow.client_contact?.full_name}
            icon={UserCircleIcon}
            style="textLight textXS"
          />

          {selectedRow.close_probability && (
            <p className="textLight textXXXS employeeListMobile cardStyle">
              <span className="textRegular">Success Probability: </span>
              {selectedRow.close_probability}%
            </p>
          )}
          {selectedRow.expected_revenue && (
            <p className="textLight textXXXS employeeListMobile cardStyle">
              <span className="textRegular">Expected Revenue: </span>
              RM{selectedRow.expected_revenue}
            </p>
          )}
        </div>

        <div className="leadSidebarDateTimeContainer">
          <p className="textRegular textXXS">{selectedRow.created_date}</p>

          <p className="textLight textXXS">{selectedRow.created_time}</p>

          <EmployeeImage
            employee={selectedRow.lead_owner}
            employeeId={selectedRow.lead_owner?.id}
            showName={showName}
            setShowName={setShowName}
            position="left"
          />
        </div>
      </div>

      {/* PIPELINE */}
      <LeadStage selectedRow={selectedRow} vertical={true} />

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
      {selectedRow.lose_reason && (
        <CardLayout style="generalCard redCard">
          <p className="textBold textXS">Lose Reason:</p>
          <p className="textRegular textXXS">{selectedRow.lose_reason}</p>
        </CardLayout>
      )}

      {/* ACTIONS */}
      <div className="leadSidebarActionsContainer">
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
                  ? "button buttonType6 rejection mobile"
                  : "button buttonType6 approval mobile"
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

      <div className="leadSidebarActionsContainer">
        {/* HOLD / RESUME */}
        {canToggleHold && (
          <Button
            icon={selectedRow.is_on_hold ? PlayCircleIcon : PauseCircleIcon}
            name={selectedRow.is_on_hold ? "Resume" : "Hold"}
            style="button buttonType6 yellow mobile"
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
            style="button buttonType6 rejection mobile"
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
      </div>

      {!isEditing && (
        <Button
          name="Edit"
          icon={PencilSimpleLineIcon}
          style="button buttonType4"
          onClick={() => setIsEditing(!isEditing)}
        />
      )}
    </div>
  );
}
