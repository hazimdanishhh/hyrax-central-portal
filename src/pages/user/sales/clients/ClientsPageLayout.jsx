import React from "react";
import { useTheme } from "../../../../context/ThemeContext";
import Breadcrumbs from "../../../../components/breadcrumbs/Breadcrumbs";
import {
  ChartLineIcon,
  HandshakeIcon,
  ListIcon,
  UsersIcon,
} from "@phosphor-icons/react";
import CardWrapper from "../../../../components/cardWrapper/CardWrapper";
import { Link, NavLink, Outlet } from "react-router";

export default function ClientsPageLayout() {
  const { darkMode } = useTheme();

  return (
    <>
      <section className={darkMode ? "sectionDark" : "sectionLight"}>
        <div className="sectionWrapper">
          <div className="sectionContent">
            <Breadcrumbs icon={UsersIcon} current="Clients Management" />

            <CardWrapper>
              <div className="pageTabContainer">
                {/* OVERVIEW */}
                <NavLink
                  to="/app/sales/clients/overview"
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
                  to="/app/sales/clients/list"
                  className={({ isActive }) =>
                    `button buttonTypeTab textRegular textXS ${
                      isActive ? "active" : ""
                    }`
                  }
                >
                  <div className="pageTabIcon">
                    <ListIcon size={15} />
                  </div>
                  All Clients
                </NavLink>

                {/* MY LEADS */}
                <NavLink
                  to="/app/sales/clients/contacts"
                  className={({ isActive }) =>
                    `button buttonTypeTab textRegular textXS ${
                      isActive ? "active" : ""
                    }`
                  }
                >
                  <div className="pageTabIcon">
                    <ListIcon size={15} />
                  </div>
                  All Contacts
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
