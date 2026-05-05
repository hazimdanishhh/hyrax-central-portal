import React from "react";
import { useTheme } from "../../../../context/ThemeContext";
import Breadcrumbs from "../../../../components/breadcrumbs/Breadcrumbs";
import {
  ChartLineIcon,
  DesktopIcon,
  GearIcon,
  ListIcon,
  UsersFourIcon,
} from "@phosphor-icons/react";
import CardWrapper from "../../../../components/cardWrapper/CardWrapper";
import { Link, NavLink, Outlet } from "react-router";

export default function EmployeePageLayout() {
  const { darkMode } = useTheme();

  return (
    <>
      <section className={darkMode ? "sectionDark" : "sectionLight"}>
        <div className="sectionWrapper">
          <div className="sectionContent">
            <Breadcrumbs icon={UsersFourIcon} current="Employee Management" />

            <CardWrapper>
              <div className="pageTabContainer">
                <NavLink
                  to="/app/hr/employees/overview"
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
                  to="/app/hr/employees/list"
                  className={({ isActive }) =>
                    `button buttonTypeTab textRegular textXS ${
                      isActive ? "active" : ""
                    }`
                  }
                >
                  <div className="pageTabIcon">
                    <ListIcon size={15} />
                  </div>
                  Employees List
                </NavLink>

                <NavLink
                  to="/app/hr/employees/settings"
                  className={({ isActive }) =>
                    `button buttonTypeTab textRegular textXS ${
                      isActive ? "active" : ""
                    }`
                  }
                >
                  <div className="pageTabIcon">
                    <GearIcon size={15} />
                  </div>
                  Settings
                </NavLink>
              </div>
              <Outlet />
            </CardWrapper>
          </div>
        </div>
      </section>
    </>
  );
}
