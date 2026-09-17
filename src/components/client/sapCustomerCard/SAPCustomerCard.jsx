import { Link } from "react-router";
import StatusBox from "../../status/statusBox/StatusBox";
import "./SAPCustomerCard.scss";

function SAPCustomerCard({ row, code, name, isSapLinked = true }) {
  return (
    <Link
      className="sapCustomerCard"
      to={
        isSapLinked
          ? `/app/sales/clients/sap/${row ? row.customer_code : code}`
          : `/app/sales/clients/prospects/${row ? row.customer_code : code}`
      }
    >
      <StatusBox
        status={
          row ? row.customer_code : isSapLinked === false ? "Prospect" : code
        }
        type="blue"
      />
      <p className="textLight textXXS" title={row ? row.customer_name : name}>
        {row ? row.customer_name : name}
      </p>
    </Link>
  );
}

export default SAPCustomerCard;
