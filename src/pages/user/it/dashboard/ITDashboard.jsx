import React from "react";
import { useTheme } from "../../../../context/ThemeContext";
import { SquaresFourIcon } from "@phosphor-icons/react";
import { quickActionsIT } from "../../../../data/quickActionsCardData";
import QuickActions from "../../../../components/quickActions/QuickActions";
import CardWrapper from "../../../../components/cardWrapper/CardWrapper";
import Breadcrumbs from "../../../../components/breadcrumbs/Breadcrumbs";

function ITDashboard() {
  const { darkMode } = useTheme();
  return (
    <>
      <section className={darkMode ? "sectionDark" : "sectionLight"}>
        <div className="sectionWrapper">
          <div className="sectionContent">
            <Breadcrumbs icon={SquaresFourIcon} current="IT Dashboard" />

            <CardWrapper>
              <QuickActions
                quickActionsList={quickActionsIT}
                title="Web Services"
              />
            </CardWrapper>
          </div>
        </div>
      </section>
    </>
  );
}

export default ITDashboard;
