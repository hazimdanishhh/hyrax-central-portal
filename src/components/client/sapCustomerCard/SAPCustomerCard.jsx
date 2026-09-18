import { Link } from "react-router";
import StatusBox from "../../status/statusBox/StatusBox";
import { useAccessControl } from "../../../context/AccessControlContext";
import "./SAPCustomerCard.scss";

/**
 * Links a customer/lead badge through to wherever the CURRENT viewer can
 * actually reach this Business Partner's record -- Sales' own SAP Clients
 * page if they have Sales access (unchanged, existing behavior), else
 * Finance's Business Partners page if they have Finance access instead.
 * Added 2026-09: this card is shared across Invoice/Payment/Sales Order/
 * Lead/Fulfillment Order cards, and previously hardcoded the Sales-only
 * destination unconditionally -- a Finance-only user viewing an Invoice or
 * Payment card hit a link into a page they're gated out of. Degrades to
 * plain, non-linked text if the viewer can reach neither (same
 * degrade-to-non-clickable pattern used elsewhere for cross-department
 * links, see docs/SALES-REPORTS-RESTRUCTURE-PLAN.md).
 */
function SAPCustomerCard({ row, code, name, isSapLinked = true }) {
  const { canAccess } = useAccessControl();
  const customerCode = row ? row.customer_code : code;

  let to;
  if (isSapLinked === false) {
    to = `/app/sales/clients/prospects/${customerCode}`;
  } else if (canAccess({ departments: ["SAL", "MGM"] })) {
    to = `/app/sales/clients/sap/${customerCode}`;
  } else if (canAccess({ departments: ["FIN", "MGM"] })) {
    to = `/app/finance/business-partners/${customerCode}`;
  }

  const content = (
    <>
      <StatusBox
        status={
          row ? row.customer_code : isSapLinked === false ? "Prospect" : code
        }
        type="blue"
      />
      <p className="textLight textXXS" title={row ? row.customer_name : name}>
        {row ? row.customer_name : name}
      </p>
    </>
  );

  if (!to) {
    return <div className="sapCustomerCard">{content}</div>;
  }

  return (
    <Link className="sapCustomerCard" to={to}>
      {content}
    </Link>
  );
}

export default SAPCustomerCard;
