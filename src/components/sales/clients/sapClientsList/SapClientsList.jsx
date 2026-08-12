import "./SapClientsList.scss";
import StatusBox from "../../../status/statusBox/StatusBox";

const CARD_TYPE_LABELS = {
  C: "Customer",
  L: "Lead",
};

export default function SapClientsList({ customer, onClick }) {
  return (
    <div className="generalCard cardPaddingSmall" onClick={onClick}>
      <div className="sapClientsListContainer">
        <div className="sapClientsListHeader">
          <p className="textRegular textXS">{customer.customer_name}</p>
          <p className="textLight textXXS">{customer.customer_code}</p>
        </div>

        <div className="sapClientsListStatusContainer">
          {customer.city && (
            <StatusBox status={customer.city} type="grey" />
          )}
          <StatusBox
            status={CARD_TYPE_LABELS[customer.card_type] || customer.card_type}
            type="blue"
          />
          {/* Sparsely populated (~76% blank) -- only show when set */}
          {customer.local_export_flag && (
            <StatusBox status={customer.local_export_flag} type="yellow" />
          )}
          {customer.is_active !== "Y" && (
            <StatusBox status="Inactive" type="red" />
          )}
        </div>
      </div>
    </div>
  );
}
