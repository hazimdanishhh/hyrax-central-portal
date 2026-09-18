import { Link, useLocation } from "react-router";
import StatusBox from "../../status/statusBox/StatusBox";
import { useAccessControl } from "../../../context/AccessControlContext";
import "./SAPCustomerCard.scss";

/**
 * Links a customer/lead badge through to whichever department's own
 * Business Partner page fits the CURRENT PAGE, not just the viewer's
 * access -- see docs/DASHBOARD-CONVENTIONS.md §5 (no inter-departmental
 * linking): a page under /app/finance/... always resolves to Finance's own
 * Business Partners page, since Finance's pages must not link into Sales,
 * even for an MGM viewer who technically could reach Sales' SAP Clients too
 * (MGM previously always won this check first, which is exactly the
 * cross-department leak §5 exists to prevent). Everywhere else (Sales'
 * Orders/Leads pages) keeps the original behavior: Sales access wins, else
 * Finance access, else plain non-linked text. Added 2026-09 (first pass):
 * this card is shared across Invoice/Payment/Sales Order/Lead/Fulfillment
 * Order cards, and previously hardcoded the Sales-only destination
 * unconditionally -- a Finance-only user viewing an Invoice or Payment card
 * hit a link into a page they're gated out of.
 */
function SAPCustomerCard({ row, code, name, isSapLinked = true }) {
  const { canAccess } = useAccessControl();
  const location = useLocation();
  const customerCode = row ? row.customer_code : code;
  const isFinancePage = location.pathname.startsWith("/app/finance");

  let to;
  if (isSapLinked === false) {
    to = `/app/sales/clients/prospects/${customerCode}`;
  } else if (isFinancePage && canAccess({ departments: ["FIN", "MGM"] })) {
    to = `/app/finance/business-partners/${customerCode}`;
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
