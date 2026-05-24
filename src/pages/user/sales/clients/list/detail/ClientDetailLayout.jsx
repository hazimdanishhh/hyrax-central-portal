import React from "react";
import {
  ChartLineIcon,
  HandshakeIcon,
  ListIcon,
  UsersIcon,
} from "@phosphor-icons/react";
import { Link, NavLink, Outlet, useParams } from "react-router";
import CardWrapper from "../../../../../../components/cardWrapper/CardWrapper";
import { useTheme } from "../../../../../../context/ThemeContext";
import Breadcrumbs from "../../../../../../components/breadcrumbs/Breadcrumbs";
import CardLayout from "../../../../../../components/cardLayout/CardLayout";
import { useClient } from "../../../../../../features/sales/clients/private/hooks/useClient";
import StatusBox from "../../../../../../components/status/statusBox/StatusBox";
import LoadingIcon from "../../../../../../components/loadingIcon/LoadingIcon";
import NoResult from "../../../../../../components/crud/noResult/NoResult";
import "./ClientDetailLayout.scss";

export default function ClientDetailLayout() {
  const { darkMode } = useTheme();
  const { clientId } = useParams();
  const {
    data: client,
    isLoading: clientLoading,
    error: clientError,
  } = useClient(clientId);

  return (
    <>
      <section className={darkMode ? "sectionDark" : "sectionLight"}>
        <div className="clientDetailLayoutContainer">
          {/* --- CLIENT DETAILS SECTION --- */}
          <CardLayout style="cardLayout1 generalCard clientDetailLayoutLeft">
            {clientLoading ? (
              <LoadingIcon />
            ) : clientError ? (
              <NoResult title="Error Loading Client" />
            ) : (
              <div className="clientDetailContainer">
                <p className="textBold">{client.name}</p>

                <div className="clientDetailSegment">
                  {client.sap_bp_id && (
                    <StatusBox
                      status={`SAP-BP-ID-${client.sap_bp_id}`}
                      type="green"
                    />
                  )}
                  {client.industry_id && (
                    <StatusBox status={client.industry?.name} type="blue" />
                  )}
                </div>
                <div className="generalCard cardPaddingSmall">
                  <span className="textBold textXS">Address: </span>
                  <p className="textRegular textXS">{client.address}</p>
                </div>
              </div>
            )}
          </CardLayout>

          {/* RIGHT COLUMN */}
          <div className="clientDetailLayoutRight">
            {/* TABS */}
            <div className="pageTabContainer">
              {/* DETAILS */}
              <NavLink
                to={`/app/sales/clients/${clientId}/overview`}
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

              {/* LEADS */}
              <NavLink
                to={`/app/sales/clients/${clientId}/contacts`}
                className={({ isActive }) =>
                  `button buttonTypeTab textRegular textXS ${
                    isActive ? "active" : ""
                  }`
                }
              >
                <div className="pageTabIcon">
                  <ListIcon size={15} />
                </div>
                Contacts
              </NavLink>

              {/* LEADS */}
              <NavLink
                to={`/app/sales/clients/${clientId}/leads`}
                className={({ isActive }) =>
                  `button buttonTypeTab textRegular textXS ${
                    isActive ? "active" : ""
                  }`
                }
              >
                <div className="pageTabIcon">
                  <ListIcon size={15} />
                </div>
                Leads
              </NavLink>

              {/* ORDERS */}
              <NavLink
                to={`/app/sales/clients/${clientId}/orders`}
                className={({ isActive }) =>
                  `button buttonTypeTab textRegular textXS ${
                    isActive ? "active" : ""
                  }`
                }
              >
                <div className="pageTabIcon">
                  <ListIcon size={15} />
                </div>
                Orders
              </NavLink>
            </div>
            <Outlet />
          </div>
        </div>
      </section>
    </>
  );
}
