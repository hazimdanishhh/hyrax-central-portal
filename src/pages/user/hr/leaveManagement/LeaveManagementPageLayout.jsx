import React from "react";
import { useTheme } from "../../../../context/ThemeContext";
import Breadcrumbs from "../../../../components/breadcrumbs/Breadcrumbs";
import { CalendarIcon } from "@phosphor-icons/react";
import CardWrapper from "../../../../components/cardWrapper/CardWrapper";
import { NavLink, Outlet } from "react-router";
import { useAccessControl } from "../../../../context/AccessControlContext";
import { leaveManagementPageTabs } from "./leaveManagementPageTabs";

/**
 * Tab shell for Leave Management, mirroring AttendancePageLayout.jsx exactly.
 *
 * The chrome (section, Breadcrumbs, CardWrapper) lives HERE, not in the tab
 * pages -- same split every other tabbed module uses. LeaveManagement.jsx
 * rendered its own until 2026-09-23 and had it stripped when it became a tab;
 * leaving it there would have drawn two breadcrumbs and two nested cards.
 */
export default function LeaveManagementPageLayout() {
  const { darkMode } = useTheme();
  const { canAccess } = useAccessControl();

  // Single source of truth shared with this link's sidenav sub-links --
  // see leaveManagementPageTabs.js's own header comment.
  const visibleTabs = leaveManagementPageTabs.filter((tab) =>
    canAccess({ roles: tab.roles, departments: tab.departments }),
  );

  return (
    <>
      <section className={darkMode ? "sectionDark" : "sectionLight"}>
        <div className="sectionWrapper">
          <div className="sectionContent">
            <Breadcrumbs icon={CalendarIcon} current="Leave Management" />

            <CardWrapper>
              <div className="pageTabContainer">
                {visibleTabs.map((tab) => {
                  const TabIcon = tab.icon;
                  return (
                    <NavLink
                      key={tab.path}
                      to={`/app/hr/leaves/${tab.path}`}
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
