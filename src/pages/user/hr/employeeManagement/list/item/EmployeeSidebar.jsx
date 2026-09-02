import React from "react";
import CardLayout from "../../../../../../components/cardLayout/CardLayout";
import {
  PencilSimpleLineIcon,
  PencilSimpleSlashIcon,
} from "@phosphor-icons/react";
import StatusBadge from "../../../../../../components/status/statusBadge/StatusBadge";
import Button from "../../../../../../components/buttons/button/Button";
import { EMPLOYEE_STATUS_TRANSITIONS } from "../../../../../../features/hr/employees/private/employeeStatusTransitions";
import "./EmployeeSidebar.scss";

// Guided status-transition buttons -- mirrors LeadSidebar.jsx's own button
// placement (the detail sidebar, not the list/card row). See
// docs/EMPLOYEE-LIFECYCLE-CHECKLIST-ARCHITECTURE.md Part 2.
//
// `canManageTransitions` gates the buttons themselves (HR dept or
// superadmin); raw editing of the underlying fields is separately gated
// superadmin-only in tableConfig.jsx -- the two are deliberately different
// tiers (HR gets the guided path, superadmin gets both).
function EmployeeSidebar({
  selectedRow,
  setIsEditing,
  isEditing,
  canManageTransitions,
  onRequestTransition,
}) {
  const currentStatusId = selectedRow.employment_status?.id;
  const currentStatusCategory = selectedRow.employment_status?.category;
  const isTerminatedNotice = currentStatusId === 13;
  const isTerminatedCategory = currentStatusCategory === "terminated";

  const showBeginOffboarding =
    canManageTransitions && !isTerminatedNotice && !isTerminatedCategory;
  const showImmediateTermination =
    canManageTransitions && !isTerminatedCategory;
  const showFinalizeDeparture = canManageTransitions && isTerminatedNotice;

  return (
    <CardLayout style="cardPadding">
      <div className="profileOverview">
        <div className="profilePhoto">
          <img
            src={
              selectedRow.profile?.avatar_url || "/profilePhoto/default.webp"
            }
            alt={selectedRow.full_name || "No Name"}
          />
        </div>

        <div className="profileOverviewDetails">
          <p className="textBold textM">
            {selectedRow.full_name || "No Name"}
            <span className="textRegular textXS">
              ({selectedRow.preferred_name || "No Name"})
            </span>
          </p>
          <p className="textLight textXXS">
            {selectedRow.department?.name || "No Department Set"}
          </p>
          <p className="textLight textXXS">
            {selectedRow.position || "No Position Set"}
          </p>
          <StatusBadge status={selectedRow.employment_status?.name} />
        </div>
      </div>

      {!isEditing ? (
        <Button
          name="Edit"
          icon={PencilSimpleLineIcon}
          style="button buttonType4 textXS"
          size={16}
          onClick={() => setIsEditing(!isEditing)}
        />
      ) : (
        <Button
          name="Cancel Edit"
          icon={PencilSimpleSlashIcon}
          onClick={() => setIsEditing(!isEditing)}
          style="button buttonType4 textXS"
          size={16}
        />
      )}

      {!isEditing &&
        (showBeginOffboarding ||
          showImmediateTermination ||
          showFinalizeDeparture) && (
          <CardLayout style="cardLayout2 cardGapSmall">
            {showBeginOffboarding && (
              <Button
                name={EMPLOYEE_STATUS_TRANSITIONS.BEGIN_OFFBOARDING.label}
                icon={EMPLOYEE_STATUS_TRANSITIONS.BEGIN_OFFBOARDING.icon}
                style={`button buttonType4 ${EMPLOYEE_STATUS_TRANSITIONS.BEGIN_OFFBOARDING.style} textXS`}
                size={16}
                onClick={() => onRequestTransition("BEGIN_OFFBOARDING")}
              />
            )}
            {showImmediateTermination && (
              <Button
                name={EMPLOYEE_STATUS_TRANSITIONS.IMMEDIATE_TERMINATION.label}
                icon={EMPLOYEE_STATUS_TRANSITIONS.IMMEDIATE_TERMINATION.icon}
                style={`button buttonType4 ${EMPLOYEE_STATUS_TRANSITIONS.IMMEDIATE_TERMINATION.style} textXS`}
                size={16}
                onClick={() => onRequestTransition("IMMEDIATE_TERMINATION")}
              />
            )}
            {showFinalizeDeparture && (
              <Button
                name={EMPLOYEE_STATUS_TRANSITIONS.FINALIZE_DEPARTURE.label}
                icon={EMPLOYEE_STATUS_TRANSITIONS.FINALIZE_DEPARTURE.icon}
                style={`button buttonType4 ${EMPLOYEE_STATUS_TRANSITIONS.FINALIZE_DEPARTURE.style} textXS`}
                size={16}
                onClick={() => onRequestTransition("FINALIZE_DEPARTURE")}
              />
            )}
          </CardLayout>
        )}
    </CardLayout>
  );
}

export default EmployeeSidebar;
