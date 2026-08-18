import "./StatusBadge.scss";

export default function StatusBadge({ status, type }) {
  const statusMap = {
    // IT Assets
    active: "active",
    inactive: "inactive",
    retired: "retired",
    lost: "lost",
    stolen: "stolen",

    // Employee Status
    probation: "probation",
    terminated: "terminated",
    resigned: "resigned",
    sabbatical: "sabbatical",
    suspended: "suspended",
    contract: "contract",
    intern: "intern",
    onleave: "on leave",
    terminatednotice: "terminated notice",

    // Attendance Approval Status
    approved: "approved",
    pending: "pending",
    rejected: "rejected",

    onHold: "ON HOLD",

    // App release phase (About page)
    uat: "pending",
    stable: "active",
  };

  const normalizedStatus = status?.toLowerCase();
  const dynamicClass = statusMap[normalizedStatus];

  return (
    <div className={`textLight textXXXS statusBadge ${dynamicClass} ${type}`}>
      <div
        className={`textLight textXXXS statusLight ${dynamicClass} ${type}`}
      />
      <p className="textLight textXXXS statusName">{status || "No Status"}</p>
    </div>
  );
}
