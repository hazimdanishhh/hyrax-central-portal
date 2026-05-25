import React, { useEffect } from "react";
import {
  ChartLineIcon,
  HandshakeIcon,
  ListIcon,
  PencilSimpleIcon,
  PlusCircleIcon,
  UsersIcon,
} from "@phosphor-icons/react";
import { Link, NavLink, Outlet, useNavigate, useParams } from "react-router";
import CardWrapper from "../../../../../../components/cardWrapper/CardWrapper";
import { useTheme } from "../../../../../../context/ThemeContext";
import Breadcrumbs from "../../../../../../components/breadcrumbs/Breadcrumbs";
import CardLayout from "../../../../../../components/cardLayout/CardLayout";
import { useClient } from "../../../../../../features/sales/clients/private/hooks/useClient";
import StatusBox from "../../../../../../components/status/statusBox/StatusBox";
import LoadingIcon from "../../../../../../components/loadingIcon/LoadingIcon";
import NoResult from "../../../../../../components/crud/noResult/NoResult";
import "./ClientDetailLayout.scss";
import { useSidebar } from "../../../../../../context/SidebarContext";
import { getClientActionConfig } from "./constants/actionConfig";
import { getClientSidebarConfig } from "./constants/sidebarConfig";
import useClientMutations from "../../../../../../features/sales/clients/private/hooks/useClientMutations";
import { useClientsMetadata } from "../../../../../../features/sales/clients/private/hooks/useClientsMetadata";
import { getTableConfig } from "../constants/tableConfig";
import { useModal } from "../../../../../../context/ActionModalContext";
import { useQueryClient } from "@tanstack/react-query";
import Button from "../../../../../../components/buttons/button/Button";
import PageTab from "../../../../../../components/navigation/pageTab/PageTab";

export default function ClientDetailLayout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { darkMode } = useTheme();
  const { clientId } = useParams();
  const {
    data: client,
    isLoading: clientLoading,
    error: clientError,
  } = useClient(clientId);
  const { sidebar, openSidebar, updateSidebar, closeSidebar } = useSidebar();
  const { openModal, closeModal } = useModal();

  // ==============
  // METADATA
  // ==============
  const {
    industries,
    isLoading: metadataLoading,
    isFetching: metadataFetching,
    error: metadataError,
  } = useClientsMetadata();

  // MUTATIONS
  const { updateClient, deleteClient, updating, deleting } =
    useClientMutations();

  // CONFIG
  const columns = getTableConfig({
    industries,
  });

  // ==============
  // SYNC SIDEBAR STATE
  // ==============
  // This ensures the global sidebar knows when the local mutations are actively running
  useEffect(() => {
    if (sidebar.open) {
      updateSidebar({
        saving: updating,
        deleting: deleting,
      });
    }
  }, [updating, deleting, sidebar.open, updateSidebar]);

  // ==============
  // HANDLE EDIT
  // ==============
  function handleEdit(client) {
    openSidebar(
      getClientSidebarConfig({
        client,
        columns,
        onSave: handleRequestSave,
        onDelete: handleRequestDelete,
        updating,
        deleting,
        onCancel: () => {
          closeSidebar();
        },
      }),
    );
  }

  // ==============
  // HANDLE REQUEST SAVE
  // ==============
  function handleRequestSave(data) {
    openModal({
      ...getClientActionConfig.save,

      onConfirm: async () => {
        await updateClient(data);

        await queryClient.invalidateQueries({
          queryKey: ["clients", clientId],
        });

        closeSidebar();
        navigate(`/app/sales/clients/${data.id}`);
      },
    });
  }

  // ==============
  // HANDLE REQUEST DELETE
  // ==============
  function handleRequestDelete(client) {
    openModal({
      ...getClientActionConfig.delete,

      onConfirm: async () => {
        await deleteClient(client.id);

        queryClient.invalidateQueries({
          queryKey: ["clients", clientId],
        });

        queryClient.invalidateQueries({
          queryKey: ["clients"],
        });

        closeSidebar();
        navigate("/app/sales/clients/list");
      },
    });
  }

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
                <Button
                  onClick={() => handleEdit(client)}
                  name="Edit Client"
                  icon={PencilSimpleIcon}
                  size={16}
                  style="button buttonType5 textXXS"
                />
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
            <PageTab
              tabs={[
                {
                  name: "Overview",
                  to: `/app/sales/clients/${clientId}/overview`,
                  icon: ChartLineIcon,
                },
                {
                  name: "Contacts",
                  to: `/app/sales/clients/${clientId}/contacts`,
                  icon: ListIcon,
                },
                {
                  name: "Leads",
                  to: `/app/sales/clients/${clientId}/leads`,
                  icon: ListIcon,
                },
                {
                  name: "Orders",
                  to: `/app/sales/clients/${clientId}/orders`,
                  icon: ListIcon,
                },
              ]}
            />

            <Outlet />
          </div>
        </div>
      </section>
    </>
  );
}
