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
import PageTab from "../../../../components/navigation/pageTab/PageTab";

export default function ClientsPageLayout() {
  const { darkMode } = useTheme();

  return (
    <>
      <section className={darkMode ? "sectionDark" : "sectionLight"}>
        <div className="sectionWrapper">
          <div className="sectionContent">
            <Breadcrumbs icon={UsersIcon} current="Clients Management" />

            <CardWrapper>
              <PageTab
                tabs={[
                  {
                    name: "Overview",
                    to: "/app/sales/clients/overview",
                    icon: ChartLineIcon,
                  },
                  {
                    name: "All Clients",
                    to: "/app/sales/clients/list",
                    icon: ListIcon,
                  },
                  {
                    name: "All Contacts",
                    to: "/app/sales/clients/contacts",
                    icon: ListIcon,
                  },
                ]}
              />

              <Outlet />
            </CardWrapper>
          </div>
        </div>
      </section>
    </>
  );
}
