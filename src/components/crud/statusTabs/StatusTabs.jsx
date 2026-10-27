// src/components/crud/statusTabs/StatusTabs.jsx

import { Link } from "react-router-dom";
import TabScroller from "../../navigation/tabScroller/TabScroller";
import "./StatusTabs.scss";

/**
 * A list page's status tabs (2026-10-27, DASHBOARD-CONVENTIONS §2a): the
 * period picker's pill look, inside TabScroller -- so the strip scrolls
 * with ‹ › arrows when it overflows and centres the active tab -- with no
 * icons. Each tab keeps its status colour (themeType): coloured text while
 * idle, filled with that colour when active.
 *
 *   tabs  [{ key?, label, to, themeType, isActive }] -- `to` is a "?..."
 *         link that keeps the page's period, filters, search and sort
 *         (build it with tabLink() in functions/statusTabs.js); exactly one
 *         tab should be active.
 *
 * Replaces the older `<div className="statusTabsRow">` + StatusTab rows;
 * other list pages move onto this one by one.
 */
export default function StatusTabs({ tabs = [], ariaLabel = "Status" }) {
  return (
    <TabScroller ariaLabel={ariaLabel} className="statusTabs">
      {tabs.map((tab) => (
        <Link
          key={tab.key ?? tab.label}
          to={tab.to}
          aria-current={tab.isActive ? "true" : undefined}
          className={`statusTabPill textXXS ${tab.themeType || "neutral"} ${
            tab.isActive ? "active" : ""
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </TabScroller>
  );
}
