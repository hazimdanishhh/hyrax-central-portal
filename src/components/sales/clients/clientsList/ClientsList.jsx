import { CaretCircleRightIcon, NotePencilIcon } from "@phosphor-icons/react";
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
          {client.sap_customer_code ? (
            <StatusBox status={`Linked — ${client.sap_customer_code}`} type="green" />
          ) : (
            <StatusBox status="Prospect" type="grey" />
          )}
          <p className="textRegular textXS">
            {client.sap_customer_code
              ? client.sap_customer?.customer_name
              : client.name}
          </p>
        </div>

        <div className="clientsListStatusContainer">
          {client.industry_id && (
            <StatusBox status={client.industry?.name} type="blue" />
          )}
          {/* <Button
            style="iconButton2"
            onClick={setIsEditing}
            icon={NotePencilIcon}
            size={16}
            weight="light"
          /> */}
          {/* <CaretCircleRightIcon size={24} /> */}
        </div>
      </div>
    </div>
  );
}
