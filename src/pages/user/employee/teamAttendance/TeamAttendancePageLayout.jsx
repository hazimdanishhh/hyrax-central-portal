import { useTheme } from "@/context/ThemeContext";
import Breadcrumbs from "@/components/breadcrumbs/Breadcrumbs";
import { UserCheckIcon } from "@phosphor-icons/react";
import CardWrapper from "@/components/cardWrapper/CardWrapper";
import { NavLink, Outlet } from "react-router";
import { useAccessControl } from "@/context/AccessControlContext";
import { teamAttendancePageTabs } from "./teamAttendancePageTabs";

export default function TeamAttendancePageLayout() {
  const { darkMode } = useTheme();
  const { canAccess } = useAccessControl();

  // Single source of truth shared with this link's sidenav sub-links --
  // see teamAttendancePageTabs.js's own header comment.
  const visibleTabs = teamAttendancePageTabs.filter((tab) =>
    canAccess({ roles: tab.roles, departments: tab.departments }),
  );

  return (
    <section className={darkMode ? "sectionDark" : "sectionLight"}>
      <div className="sectionWrapper">
        <div className="sectionContent">
          <Breadcrumbs icon={UserCheckIcon} current="Team Attendance" />

          <CardWrapper>
            <div className="pageTabContainer">
              {visibleTabs.map((tab) => {
                const TabIcon = tab.icon;
                return (
                  <NavLink
                    key={tab.path}
                    to={`/app/employee/team-attendance/${tab.path}`}
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
