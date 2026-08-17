// components/crud/statusTab/StatusTab.jsx
import { Link } from "react-router";
import "./StatusTab.scss";

/**
 * Promoted from sales/leads/leadStageTab/LeadStageTab.jsx -- zero
 * Leads-specific logic, just a URL-driven pill. Reused by any list page's
 * status-tabs strip (Sales Leads' own bespoke stageTabsConfig, and
 * src/functions/statusTabs.js's generic buildStatusTabs for
 * Projects/My Tasks/Project Tasks).
 */
export default function StatusTab({ to, label, isActive, themeType }) {
  return (
    <Link
      to={to}
      className={`button buttonType5 ${themeType} textRegular textXS ${isActive ? "active" : ""}`}
    >
      {label}
    </Link>
  );
}
