import "./SapClientSidebar.scss";
import StatusBox from "../../../../../../components/status/statusBox/StatusBox";
import CardLayout from "../../../../../../components/cardLayout/CardLayout";

const CARD_TYPE_LABELS = {
  C: "Customer",
  L: "Lead",
};

/**
 * Read-only detail panel -- sap_customers is a mirror of SAP, so there's no
 * Edit action here, unlike ClientSidebar (Prospects are editable).
 */
export default function SapClientSidebar({ selectedRow }) {
  return (
    <div className="sapClientSidebarContainer">
      <CardLayout style="cardLayout1 generalCard sapClientSidebarLeft">
        <p className="textBold">{selectedRow.customer_name}</p>
        <p className="textLight textXXS">{selectedRow.customer_code}</p>

        <div className="sapClientSidebarStatusContainer">
          <StatusBox
            status={
              CARD_TYPE_LABELS[selectedRow.card_type] || selectedRow.card_type
            }
            type="blue"
          />
          {selectedRow.local_export_flag && (
            <StatusBox status={selectedRow.local_export_flag} type="yellow" />
          )}
          {selectedRow.is_active !== "Y" && (
            <StatusBox status="Inactive" type="red" />
          )}
        </div>

        <div className="generalCard cardPaddingSmall sapClientSidebarDetails">
          <div>
            <span className="textBold textXS">Contact Person: </span>
            <p className="textRegular textXS">
              {selectedRow.contact_person || "—"}
            </p>
          </div>
          <div>
            <span className="textBold textXS">Phone: </span>
            <p className="textRegular textXS">{selectedRow.phone || "—"}</p>
          </div>
          <div>
            <span className="textBold textXS">Email: </span>
            <p className="textRegular textXS">{selectedRow.email || "—"}</p>
          </div>
          <div>
            <span className="textBold textXS">Location: </span>
            <p className="textRegular textXS">
              {[selectedRow.city, selectedRow.country]
                .filter(Boolean)
                .join(", ") || "—"}
            </p>
          </div>
          <div>
            <span className="textBold textXS">Balance: </span>
            <p className="textRegular textXS">
              RM {Math.round(selectedRow.balance || 0).toLocaleString()}
            </p>
          </div>
          <div>
            <span className="textBold textXS">Credit Limit: </span>
            <p className="textRegular textXS">
              RM {Math.round(selectedRow.credit_limit || 0).toLocaleString()}
            </p>
          </div>
        </div>
      </CardLayout>
    </div>
  );
}
