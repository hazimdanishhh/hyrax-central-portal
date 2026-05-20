import React from "react";
import CardLayout from "../../../../../../components/cardLayout/CardLayout";
import {
  PencilSimpleLineIcon,
  PencilSimpleSlashIcon,
} from "@phosphor-icons/react";
import StatusBadge from "../../../../../../components/status/statusBadge/StatusBadge";
import Button from "../../../../../../components/buttons/button/Button";

function EmployeeSidebar({ selectedRow, setIsEditing, isEditing }) {
  return (
    <CardLayout style="cardPadding">
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
    </CardLayout>
  );
}

export default EmployeeSidebar;
