import "./StatusBadge.scss";

export default function StatusBadge({ status }) {
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
  };

  const normalizedStatus = status?.toLowerCase();
  const dynamicClass = statusMap[normalizedStatus];

  return (
    <div className={`textLight textXXXS statusBadge ${dynamicClass}`}>
      <div className={`textLight textXXXS statusLight ${dynamicClass}`} />
      <p className="textLight textXXXS statusName">{status || "No Status"}</p>
    </div>
  );
}
