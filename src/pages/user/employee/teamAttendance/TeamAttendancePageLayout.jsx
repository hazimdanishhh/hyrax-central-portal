import { useTheme } from "@/context/ThemeContext";
import Breadcrumbs from "@/components/breadcrumbs/Breadcrumbs";
import { ListIcon, UserCheckIcon } from "@phosphor-icons/react";
import CardWrapper from "@/components/cardWrapper/CardWrapper";
import { NavLink, Outlet } from "react-router";

// Single tab in v1 -- no Overview NavLink yet (that route doesn't exist).
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
