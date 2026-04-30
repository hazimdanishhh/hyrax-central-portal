import React from "react";
import { useTheme } from "../../../../context/ThemeContext";
import Breadcrumbs from "../../../../components/breadcrumbs/Breadcrumbs";
import { ChartLineIcon, DesktopIcon, ListIcon } from "@phosphor-icons/react";
import CardWrapper from "../../../../components/cardWrapper/CardWrapper";
import { Link, NavLink, Outlet } from "react-router";
import "./ITAssetsPageLayout.scss";

export default function ITAssetsPageLayout() {
  const { darkMode } = useTheme();

  return (
    <>
      <section className={darkMode ? "sectionDark" : "sectionLight"}>
        <div className="sectionWrapper">
          <div className="sectionContent">
            <Breadcrumbs icon={DesktopIcon} current="IT Assets" />

            <CardWrapper>
              <div className="pageTabContainer">
                <NavLink
                  to="/app/it/assets/overview"
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
                  to="/app/it/assets/list"
                  className={({ isActive }) =>
                    `button buttonTypeTab textRegular textXS ${
                      isActive ? "active" : ""
                    }`
                  }
                >
                  <div className="pageTabIcon">
                    <ListIcon size={15} />
                  </div>
                  Asset List
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
