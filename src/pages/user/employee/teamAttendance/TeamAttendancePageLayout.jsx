import { useTheme } from "@/context/ThemeContext";
import Breadcrumbs from "@/components/breadcrumbs/Breadcrumbs";
import { ChartLineIcon, ListIcon, UserCheckIcon } from "@phosphor-icons/react";
import CardWrapper from "@/components/cardWrapper/CardWrapper";
import { NavLink, Outlet } from "react-router";

export default function TeamAttendancePageLayout() {
  const { darkMode } = useTheme();

  return (
    <section className={darkMode ? "sectionDark" : "sectionLight"}>
      <div className="sectionWrapper">
        <div className="sectionContent">
          <Breadcrumbs icon={UserCheckIcon} current="Team Attendance" />

          <CardWrapper>
            <div className="pageTabContainer">
              <NavLink
                to="/app/employee/team-attendance/overview"
                className={({ isActive }) =>
                  `button buttonTypeTab textRegular textXS ${
                    isActive ? "active" : ""
                  }`
                }
              >
                <div className="pageTabIcon">
                  <ChartLineIcon size={15} />
                </div>
                Overview
              </NavLink>

              <NavLink
                to="/app/employee/team-attendance/list"
                className={({ isActive }) =>
                  `button buttonTypeTab textRegular textXS ${
                    isActive ? "active" : ""
                  }`
                }
              >
                <div className="pageTabIcon">
                  <ListIcon size={15} />
                </div>
                Attendance List
              </NavLink>
            </div>
            <Outlet />
          </CardWrapper>
        </div>
      </div>
    </section>
  );
}
