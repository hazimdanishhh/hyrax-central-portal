import React from "react";
import { useTheme } from "../../../../context/ThemeContext";
import Breadcrumbs from "../../../../components/breadcrumbs/Breadcrumbs";
import { UsersFourIcon } from "@phosphor-icons/react";
import CardWrapper from "../../../../components/cardWrapper/CardWrapper";
import { Link, NavLink, Outlet } from "react-router";
import { useAccessControl } from "../../../../context/AccessControlContext";
import { employeePageTabs } from "./employeePageTabs";

export default function EmployeePageLayout() {
  const { darkMode } = useTheme();
  const { canAccess } = useAccessControl();

  // Single source of truth shared with this link's sidenav sub-links --
  // see employeePageTabs.js's own header comment.
  const visibleTabs = employeePageTabs.filter((tab) =>
    canAccess({ roles: tab.roles, departments: tab.departments }),
  );

  return (
    <>
      <section className={darkMode ? "sectionDark" : "sectionLight"}>
        <div className="sectionWrapper">
          <div className="sectionContent">
            <Breadcrumbs icon={UsersFourIcon} current="Employee Management" />

            <CardWrapper>
              <div className="pageTabContainer">
                {visibleTabs.map((tab) => {
                  const TabIcon = tab.icon;
                  return (
                    <NavLink
                      key={tab.path}
                      to={`/app/hr/employees/${tab.path}`}
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
