import { NotePencilIcon } from "@phosphor-icons/react";
import Button from "../../../buttons/button/Button";
import "./ClientsList.scss";
import StatusBox from "../../../status/statusBox/StatusBox";

export default function ClientsList({
  client,
  onClick,
  saving,
  deleting,
  setIsEditing,
  selected,
  onSelect,
}) {
  return (
    <div
      className="generalCard cardPaddingSmall"
      onClick={saving ? null : deleting ? null : onClick}
    >
      <div className="clientsListContainer">
        <div className="clientsListHeader">
          {client.sap_bp_id && (
            <StatusBox status={`BP-${client.sap_bp_id}`} type="green" />
          )}
          <p className="textRegular textXS">{client.name}</p>
        </div>

        <div className="clientsListStatusContainer">
          <StatusBox status={client.industry?.name} type="blue" />
          <Button
            style="iconButton2"
            onClick={setIsEditing}
            icon={NotePencilIcon}
            size={16}
            weight="light"
          />
        </div>
      </div>
    </div>
  );
}
