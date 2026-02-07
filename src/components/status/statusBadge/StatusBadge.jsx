import "./StatusBadge.scss";

export default function StatusBadge({ status }) {
  return (
    <div
      className={
        status === "active" || status === "Active"
          ? "textLight textXXXS statusBadge active"
          : "textLight textXXXS statusBadge inactive"
      }
    >
      <div
        className={
          status === "active" || status === "Active"
            ? "textLight textXXXS statusLight active"
            : "textLight textXXXS statusLight inactive"
        }
      />
      <p className="textLight textXXXS statusName">
        {status || "Status Undefined"}
      </p>
    </div>
  );
}
