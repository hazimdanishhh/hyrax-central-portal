import { useTheme } from "../../../../context/ThemeContext";
import Breadcrumbs from "../../../../components/breadcrumbs/Breadcrumbs";
import { TreeStructureIcon } from "@phosphor-icons/react";
import CardWrapper from "../../../../components/cardWrapper/CardWrapper";
import { NavLink, Outlet } from "react-router";
import { useAccessControl } from "../../../../context/AccessControlContext";
import { chartOfAccountsPageTabs } from "./chartOfAccountsPageTabs";

/**
 * Page-tab shell for Chart of Accounts -- "List" (the existing
 * search/filter/tree reference view) and "Overview" (added 2026-09, per-annum
 * charts for every level-1/drawer root). Same shape as InvoicesPageLayout.jsx/
 * BillsPageLayout.jsx.
 */
export default function ChartOfAccountsPageLayout() {
  const { darkMode } = useTheme();
  const { canAccess } = useAccessControl();

  const visibleTabs = chartOfAccountsPageTabs.filter((tab) =>
    canAccess({ roles: tab.roles, departments: tab.departments }),
  );

  return (
    <section className={darkMode ? "sectionDark" : "sectionLight"}>
      <div className="sectionWrapper">
        <div className="sectionContent">
          <Breadcrumbs icon={TreeStructureIcon} current="Chart of Accounts" />

          <CardWrapper>
            <div className="pageTabContainer">
              {visibleTabs.map((tab) => {
                const TabIcon = tab.icon;
                return (
                  <NavLink
                    key={tab.path}
                    to={`/app/finance/chart-of-accounts/${tab.path}`}
                    className={({ isActive }) =>
                      `button buttonTypeTab textRegular textXS ${
                        isActive ? "active" : ""
                      }`
                    }
                  >
                    <div className="pageTabIcon">
                      <TabIcon size={15} />
                    </div>
                    {tab.label}
                  </NavLink>
                );
              })}
            </div>
            <Outlet />
          </CardWrapper>
        </div>
      </div>
    </section>
  );
}
