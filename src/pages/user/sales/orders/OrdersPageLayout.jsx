import { useTheme } from "../../../../context/ThemeContext";
import Breadcrumbs from "../../../../components/breadcrumbs/Breadcrumbs";
import { ReceiptIcon } from "@phosphor-icons/react";
import CardWrapper from "../../../../components/cardWrapper/CardWrapper";
import { NavLink, Outlet } from "react-router";
import { useAccessControl } from "../../../../context/AccessControlContext";
import { ordersPageTabs } from "./ordersPageTabs";

export default function OrdersPageLayout() {
  const { darkMode } = useTheme();
  const { canAccess } = useAccessControl();

  // Single source of truth shared with this link's sidenav sub-links --
  // see ordersPageTabs.js's own header comment.
  const visibleTabs = ordersPageTabs.filter((tab) =>
    canAccess({ roles: tab.roles, departments: tab.departments }),
  );

  return (
    <section className={darkMode ? "sectionDark" : "sectionLight"}>
      <div className="sectionWrapper">
        <div className="sectionContent">
          <Breadcrumbs icon={ReceiptIcon} current="Sales Orders" />

          <CardWrapper>
            <div className="pageTabContainer">
              {visibleTabs.map((tab) => {
                const TabIcon = tab.icon;
                return (
                  <NavLink
                    key={tab.path}
                    to={`/app/sales/orders/${tab.path}`}
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
