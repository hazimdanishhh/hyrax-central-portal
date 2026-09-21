import "./BusinessPartnersList.scss";
import StatusBox from "../../status/statusBox/StatusBox";

const CARD_TYPE_LABELS = {
  C: "Customer",
  L: "Lead",
  S: "Vendor",
};

// AR+AP mirror of SapClientsList.jsx -- same row shape, extended with the
// Vendor card_type label SAP Clients (Sales' Customer+Lead-only list)
// never needed.
export default function BusinessPartnersList({ partner, onClick }) {
  return (
    <div className="generalCard cardPaddingSmall" onClick={onClick}>
      <div className="businessPartnersListContainer">
        <div className="businessPartnersListHeader">
          <p className="textRegular textXS">{partner.customer_name}</p>
          <p className="textLight textXXS">{partner.customer_code}</p>
        </div>

        <div className="businessPartnersListStatusContainer">
          {/* {partner.city && <StatusBox status={partner.city} type="grey" />} */}
          <StatusBox
            status={CARD_TYPE_LABELS[partner.card_type] || partner.card_type}
            type="blue"
          />
          {/* Sparsely populated -- only show when set */}
          {partner.local_export_flag && (
            <StatusBox status={partner.local_export_flag} type="yellow" />
          )}
          {partner.is_active !== "Y" && (
            <StatusBox status="Inactive" type="red" />
          )}
        </div>
      </div>
    </div>
  );
}
