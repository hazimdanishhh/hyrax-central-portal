import { useNavigate } from "react-router";

// Shared by SalesOrderCard/InvoiceCard (both carry a sap_*.sales_rep_code
// resolved to `rep` via salesOrdersService.js's fetchRepsByCode/attachRep).
// A plain <button>, not a <Link> -- the card itself may already be a <Link>
// when its own `to` prop is set, so a nested real anchor would reintroduce
// the exact <a>-inside-<a> hydration bug already fixed once on these cards.
// Three states, not two -- "no rep code at all" (Unassigned) and "rep code
// with no employee_sales_rep_mapping row" are different facts. The latter
// still shows the real SAP sales-person name (attachRep's namesByCode
// fallback, sourced from sap_sales_persons) since that's independent of
// whether the code has ever been linked to a portal employee -- only the
// numeric code is used as a last-resort label if even that name is missing.
// Neither non-mapped state is ever clickable (there's no employee `id` to
// navigate to for either).
export default function SalesRepBadge({ rep, repCode }) {
  const navigate = useNavigate();
  const avatarUrl = rep?.avatar_url || "/profilePhoto/default.webp";

  if (!repCode) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <img
          className="salesOrderRepAvatar"
          src={avatarUrl}
          alt="Unassigned"
        />
        <p className="textLight textXXS">Unassigned</p>
      </div>
    );
  }

  if (!rep?.id) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <img
          className="salesOrderRepAvatar"
          src={avatarUrl}
          alt="Unmapped sales rep"
        />
        <p className="textLight textXXS">
          {rep?.full_name || `Unmapped rep #${repCode}`}
        </p>
      </div>
    );
  }

  return (
    <button
      type="button"
      style={{ display: "flex", alignItems: "center", gap: "8px" }}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        navigate(`/app/employees/${rep.id}`);
      }}
    >
      <img
        className="salesOrderRepAvatar"
        src={avatarUrl}
        alt={rep.full_name || "Sales Rep"}
      />
      <p className="textRegular textXXS">{rep.full_name}</p>
    </button>
  );
}
