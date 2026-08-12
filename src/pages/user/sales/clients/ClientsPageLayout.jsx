import React from "react";
import { useTheme } from "../../../../context/ThemeContext";
import Breadcrumbs from "../../../../components/breadcrumbs/Breadcrumbs";
import {
  DatabaseIcon,
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
            <Breadcrumbs icon={UsersIcon} current="Clients" />

            <CardWrapper>
              <div className="pageTabContainer">
                {/* PROSPECTS */}
                <NavLink
                  to="/app/sales/clients/prospects"
                  className={({ isActive }) =>
                    `button buttonTypeTab textRegular textXS ${
                      isActive ? "active" : ""
                    }`
                  }
                >
                  <div className="pageTabIcon">
                    <ListIcon size={15} />
                  </div>
                  Prospects
                </NavLink>

                {/* SAP CLIENTS */}
                <NavLink
                  to="/app/sales/clients/sap"
                  className={({ isActive }) =>
                    `button buttonTypeTab textRegular textXS ${
                      isActive ? "active" : ""
                    }`
                  }
                >
                  <div className="pageTabIcon">
                    <DatabaseIcon size={15} />
                  </div>
                  SAP Clients
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
