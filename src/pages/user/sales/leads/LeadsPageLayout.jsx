import React from "react";
import { useTheme } from "../../../../context/ThemeContext";
import Breadcrumbs from "../../../../components/breadcrumbs/Breadcrumbs";
import { ChartLineIcon, HandshakeIcon, ListIcon } from "@phosphor-icons/react";
import CardWrapper from "../../../../components/cardWrapper/CardWrapper";
import { Link, NavLink, Outlet } from "react-router";
import { useEmployee } from "../../../../context/EmployeeContext";

export default function LeadsPageLayout() {
  const { darkMode } = useTheme();
  const { employee } = useEmployee();

  return (
    <>
      <section className={darkMode ? "sectionDark" : "sectionLight"}>
        <div className="sectionWrapper">
          <div className="sectionContent">
            <Breadcrumbs icon={HandshakeIcon} current="Leads Management" />

            <CardWrapper>
              <div className="pageTabContainer">
                {/* OVERVIEW */}
                <NavLink
                  to="/app/sales/leads/overview"
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

                {/* ALL LEADS */}
                <NavLink
                  to="/app/sales/leads/list"
                  className={({ isActive }) =>
                    `button buttonTypeTab textRegular textXS ${
                      isActive ? "active" : ""
                    }`
                  }
                >
                  <div className="pageTabIcon">
                    <ListIcon size={15} />
                  </div>
                  All Leads
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
