import { Link } from "react-router";
import StatusBox from "../../status/statusBox/StatusBox";
import "./SAPVendorCard.scss";

// AP mirror of SAPCustomerCard.jsx -- vendor cards only ever appear on
// Finance-gated pages (Bills/Vendor Payments), so this always links to the
// Business Partners page directly, no department branching needed (see
// SAPCustomerCard.jsx's own comment for why IT needs branching). `nestedLink`
// mirrors SAPCustomerCard.jsx's own prop -- pass false when this is rendered
// inside a card that's itself a <Link> (BillCard/VendorPaymentCard), so this
// doesn't produce an invalid nested <a>.
function SAPVendorCard({ row, code, name, nestedLink = true }) {
  const content = (
    <>
      <StatusBox status={row ? row.vendor_code : code} type="blue" />
      <p className="textLight textXXS" title={row ? row.vendor_name : name}>
        {row ? row.vendor_name : name}
      </p>
    </>
  );

  if (nestedLink === false) {
    return <div className="sapVendorCard">{content}</div>;
  }

  return (
    <Link
      className="sapVendorCard"
      to={`/app/finance/business-partners/${row ? row.vendor_code : code}`}
    >
      {content}
    </Link>
  );
}

export default SAPVendorCard;
