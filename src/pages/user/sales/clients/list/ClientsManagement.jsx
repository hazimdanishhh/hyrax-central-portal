import { PlusCircleIcon } from "@phosphor-icons/react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import CardLayout from "../../../../../components/cardLayout/CardLayout";
import CrudFunctions from "../../../../../components/crud/crudFunctions/CrudFunctions";
import NoResult from "../../../../../components/crud/noResult/NoResult";
import DataTable from "../../../../../components/dataTable/DataTable";
import LoadingIcon from "../../../../../components/loadingIcon/LoadingIcon";
import ClientsList from "../../../../../components/sales/clients/clientsList/ClientsList";
import { useModal } from "../../../../../context/ActionModalContext";
import { useEmployee } from "../../../../../context/EmployeeContext";
import { useSidebar } from "../../../../../context/SidebarContext";
import { useTheme } from "../../../../../context/ThemeContext";
import { fetchClients } from "../../../../../features/sales/clients/private/api/clientsService";
import { useClientsMetadata } from "../../../../../features/sales/clients/private/hooks/useClientsMetadata";
import usePaginatedQuery from "../../../../../hooks/usePaginatedQuery";
import "./ClientsManagement.scss";
import { getFilterConfig } from "./constants/filterConfig";
import { getLayoutConfig } from "./constants/layoutConfig";
import { getSortConfig } from "./constants/sortConfig";
import { getTableConfig } from "./constants/tableConfig";
import { useClientHandlers } from "./constants/useClientHandlers";

/**
 * SALES Clients Management Page
 * This is private Sales clients data
 * Server-side filtering and pagination
 */
export default function ClientsManagement() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { darkMode } = useTheme();
  const { employee } = useEmployee();
  const { clientId } = useParams();
  const { sidebar, openSidebar, updateSidebar, closeSidebar } = useSidebar();
  const { openModal } = useModal();
  const [searchParams] = useSearchParams();
  const [layout, setLayout] = useState(0); // 0: List, 1: Table

  // ==============
  // HOOKS
  // ==============
  const {
    data: clients,
    totalCount,
    page,
    totalPages,
    search,
    filters,
    sortBy,
    sortOrder,
    activeFilters,
    hasActiveFilters,
    setPage,
    setSearch,
    setFilters,
    setSortBy,
    setSortOrder,
    resetParams,
    isLoading: clientsLoading,
    isFetching: clientsFetching,
    error: clientsError,
  } = usePaginatedQuery({
    queryKey: "clients",
    queryFn: fetchClients,
    pageSize: 20,
    defaultSortBy: "name",
    defaultSortOrder: "ascending",
  });

  // ==============
  // METADATA
  // ==============
  const {
    industries,
    isLoading: metadataLoading,
    isFetching: metadataFetching,
    error: metadataError,
  } = useClientsMetadata();

  // ==============
  // CONFIG
  // ==============
  const columns = getTableConfig({
    industries,
  });
  const filterConfig = getFilterConfig({
    industries,
  });
  const layoutOptions = getLayoutConfig();
  const sortOptions = getSortConfig();

  // ==============
  // DATA LOADING
  // ==============
  const isLoading = clientsLoading || metadataLoading;
  const error = clientsError || metadataError;
  const isFetching = clientsFetching || metadataFetching;
  const hasData = clients.length > 0;

  // ==============
  // BUSINESS LOGIC & MUTATIONS
  // ==============
  const { handleCreate, handleEdit, isSaving, deleting } = useClientHandlers({
    columns,
  });

  // ==============
  // DIRECT URL ACCESS (Open Sidebar automatically)
  // ==============
  useEffect(() => {
    if (isLoading || !clientId || sidebar.open) return;

    if (clientId === "new") {
      handleCreate();
    } else {
      const existingClient = clients.find((c) => c.id === clientId);
      if (existingClient) {
        handleEdit(existingClient);
      }
    }
  }, [clientId, isLoading]);

  // ==============
  // SYNC SIDEBAR STATE
  // ==============
  // This ensures the global sidebar knows when the local mutations are actively running
  useEffect(() => {
    if (sidebar.open) {
      updateSidebar({
        saving: isSaving,
        deleting: deleting,
      });
    }
  }, [isSaving, deleting, sidebar.open, updateSidebar]);

  return (
    <>
      <CrudFunctions
        search={search}
        setSearch={setSearch}
        filters={filters}
        setFilters={setFilters}
        filterConfig={filterConfig}
        placeholder="Search companies..."
        hasActiveFilters={hasActiveFilters}
        activeFilters={activeFilters}
        resetParams={resetParams}
        layout={layout}
        setLayout={setLayout}
        layoutOptions={layoutOptions}
        actionButtons={[
          {
            name: "Add Client",
            icon: PlusCircleIcon,
            style: "button buttonType5 approval textXXS",
            onClick: () => {
              handleCreate();
            },
          },
        ]}
        sortBy={sortBy}
        setSortBy={setSortBy}
        sortOptions={sortOptions}
        sortOrder={sortOrder}
        setSortOrder={setSortOrder}
        data={clients}
        totalCount={totalCount}
        page={page}
        setPage={setPage}
        totalPages={totalPages}
        error={error}
      />

      {/* TABLE DISPLAY UI */}
      <CardLayout style="cardWrapperScroll generalCard">
        {isLoading || isFetching ? (
          <CardLayout style="cardLayoutFlexFull">
            <LoadingIcon />
          </CardLayout>
        ) : !hasData ? (
          <NoResult />
        ) : error ? (
          <NoResult title="Error Loading Results" />
        ) : layout === 1 ? (
          // TABLE LAYOUT
          <DataTable
            data={clients}
            columns={columns}
            rowKey="id"
            onRowClick={(client) => navigate(`/app/sales/clients/${client.id}`)}
          />
        ) : (
          // LIST LAYOUT
          <CardLayout style="cardLayout1 cardPaddingSmall cardGapSmall">
            {clients.map((client) => (
              <ClientsList
                key={client.id}
                client={client}
                onClick={() => navigate(`/app/sales/clients/${client.id}`)}
                onEdit={() => handleEdit(client)}
                saving={isSaving}
                deleting={deleting}
              />
            ))}
          </CardLayout>
        )}
      </CardLayout>
    </>
  );
}
