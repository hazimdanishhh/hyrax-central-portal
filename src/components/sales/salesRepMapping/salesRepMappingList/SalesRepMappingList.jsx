import "./SalesRepMappingList.scss";
import StatusBox from "../../../status/statusBox/StatusBox";

export default function SalesRepMappingList({ mapping, onClick }) {
  return (
    <div className="generalCard cardPaddingSmall" onClick={onClick}>
      <div className="salesRepMappingListContainer">
        <div className="salesRepMappingListHeader">
          <p className="textRegular textXS">
            {mapping.sap_sales_person?.sales_rep_name || "—"}
          </p>
          <p className="textLight textXXS">{mapping.sales_rep_code}</p>
        </div>

        <div className="salesRepMappingListStatusContainer">
          <StatusBox
            status={mapping.employee?.full_name || "Unmapped"}
            type={mapping.employee ? "blue" : "grey"}
          />
          {mapping.sap_sales_person?.is_active !== "Y" && (
            <StatusBox status="Inactive" type="red" />
          )}
        </div>
      </div>
    </div>
  );
}
