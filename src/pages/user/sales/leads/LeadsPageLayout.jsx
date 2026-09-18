import React from "react";
import { useTheme } from "../../../../context/ThemeContext";
import Breadcrumbs from "../../../../components/breadcrumbs/Breadcrumbs";
import { HandshakeIcon } from "@phosphor-icons/react";
import CardWrapper from "../../../../components/cardWrapper/CardWrapper";
import { Link, NavLink, Outlet } from "react-router";
import { useEmployee } from "../../../../context/EmployeeContext";
import { useAccessControl } from "../../../../context/AccessControlContext";
import { leadsPageTabs } from "./leadsPageTabs";

export default function LeadsPageLayout() {
  const { darkMode } = useTheme();
  const { employee } = useEmployee();
  const { canAccess } = useAccessControl();

  // Single source of truth shared with this link's sidenav sub-links --
  // see leadsPageTabs.js's own header comment.
  const visibleTabs = leadsPageTabs.filter((tab) =>
    canAccess({ roles: tab.roles, departments: tab.departments }),
  );

  return (
    <>
      <section className={darkMode ? "sectionDark" : "sectionLight"}>
        <div className="sectionWrapper">
          <div className="sectionContent">
            <Breadcrumbs icon={HandshakeIcon} current="Leads Pipeline" />

            <CardWrapper>
              <div className="pageTabContainer">
                {visibleTabs.map((tab) => {
                  const TabIcon = tab.icon;
                  return (
                    <NavLink
                      key={tab.path}
                      to={`/app/sales/leads/${tab.path}`}
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
    </>
  );
}
