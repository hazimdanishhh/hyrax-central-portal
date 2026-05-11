import React from "react";
import CardLayout from "../../../../../../components/cardLayout/CardLayout";
import { PencilSimpleLineIcon } from "@phosphor-icons/react";
import StatusBadge from "../../../../../../components/status/statusBadge/StatusBadge";
import Button from "../../../../../../components/buttons/button/Button";

function EmployeeSidebar({ selectedRow, setIsEditing, isEditing }) {
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
      {!isEditing && (
        <Button
          name="Edit"
          icon={PencilSimpleLineIcon}
          style="button buttonType4"
          onClick={() => setIsEditing(!isEditing)}
        />
      )}
    </CardLayout>
  );
}

export default EmployeeSidebar;
