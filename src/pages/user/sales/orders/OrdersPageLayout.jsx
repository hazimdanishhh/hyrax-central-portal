import { useTheme } from "../../../../context/ThemeContext";
import Breadcrumbs from "../../../../components/breadcrumbs/Breadcrumbs";
import { ListIcon, ReceiptIcon, WalletIcon } from "@phosphor-icons/react";
import CardWrapper from "../../../../components/cardWrapper/CardWrapper";
import { NavLink, Outlet } from "react-router";

export default function OrdersPageLayout() {
  const { darkMode } = useTheme();

  return (
    <section className={darkMode ? "sectionDark" : "sectionLight"}>
      <div className="sectionWrapper">
        <div className="sectionContent">
          <Breadcrumbs icon={ReceiptIcon} current="Sales Orders" />

          <CardWrapper>
            <div className="pageTabContainer">
              {/* ALL ORDERS */}
              <NavLink
                to="/app/sales/orders/all"
                className={({ isActive }) =>
                  `button buttonTypeTab textRegular textXS ${
                    isActive ? "active" : ""
                  }`
                }
              >
                <div className="pageTabIcon">
                  <ListIcon size={15} />
                </div>
                All Orders
              </NavLink>

              {/* BUDGETS */}
              <NavLink
                to="/app/sales/orders/budgets"
                className={({ isActive }) =>
                  `button buttonTypeTab textRegular textXS ${
                    isActive ? "active" : ""
                  }`
                }
              >
                <div className="pageTabIcon">
                  <WalletIcon size={15} />
                </div>
                Budgets
              </NavLink>
            </div>
            <Outlet />
          </CardWrapper>
        </div>
      </div>
    </section>
  );
}
