import { useTheme } from "@/context/ThemeContext";
import Breadcrumbs from "@/components/breadcrumbs/Breadcrumbs";
import { ClockUserIcon, ListIcon } from "@phosphor-icons/react";
import CardWrapper from "@/components/cardWrapper/CardWrapper";
import { NavLink, Outlet } from "react-router";

// Single tab in v1 -- no Overview NavLink yet (that route doesn't exist),
// deliberately avoiding HR's own AttendancePageLayout's dead "Settings" tab
// (a NavLink with no matching route).
export default function AttendancePageLayout() {
  const { darkMode } = useTheme();

  return (
    <section className={darkMode ? "sectionDark" : "sectionLight"}>
      <div className="sectionWrapper">
        <div className="sectionContent">
          <Breadcrumbs icon={ClockUserIcon} current="My Attendance" />

          <CardWrapper>
            <div className="pageTabContainer">
              <NavLink
                to="/app/employee/attendance/list"
                className={({ isActive }) =>
                  `button buttonTypeTab textRegular textXS ${
                    isActive ? "active" : ""
                  }`
                }
              >
                <div className="pageTabIcon">
                  <ListIcon size={15} />
                </div>
                Attendance History
              </NavLink>
            </div>
            <Outlet />
          </CardWrapper>
        </div>
      </div>
    </section>
  );
}
