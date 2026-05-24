// pages/user/it/ITAssetManagement/list/ITAssetManagement.jsx
import {
  CheckCircleIcon,
  DesktopIcon,
  ListIcon,
  PencilSimpleLineIcon,
  PlusCircleIcon,
  UserMinusIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import CardLayout from "../../../../../components/cardLayout/CardLayout";
import LoadingIcon from "../../../../../components/loadingIcon/LoadingIcon";
import { useTheme } from "../../../../../context/ThemeContext";
import "./ClientsManagement.scss";
import { useEffect, useMemo, useState } from "react";
import CardWrapper from "../../../../../components/cardWrapper/CardWrapper";
import Breadcrumbs from "../../../../../components/breadcrumbs/Breadcrumbs";
import SearchFilterBar from "../../../../../components/searchFilterBar/SearchFilterBar";
import DataTable from "../../../../../components/dataTable/DataTable";
import DataSidebar from "../../../../../components/dataSidebar/DataSidebar";
import { AnimatePresence } from "framer-motion";
import ITAssetList from "../../../../../components/itAsset/itAssetList/ITAssetList";
import ActiveFiltersBar from "../../../../../components/crud/activeFiltersBar/ActiveFiltersBar";
import PageHeader from "../../../../../components/crud/pageHeader/PageHeader";
import PageTab from "../../../../../components/navigation/pageTab/PageTab";
import ActionModal from "../../../../../components/modals/actionModal/ActionModal";
import PageLayout from "../../../../../components/crud/pageLayout/PageLayout";
import PageResult from "../../../../../components/crud/pageResult/PageResult";
import NoResult from "../../../../../components/crud/noResult/NoResult";
import OverviewCards from "../../../../../components/crud/overviewCards/OverviewCards";
import SortBar from "../../../../../components/crud/sortBar/SortBar";
import { useQueryClient } from "@tanstack/react-query";
import usePaginatedQuery from "../../../../../hooks/usePaginatedQuery";
import ChartCard from "../../../../../components/chartCard/ChartCard";
import PieChartRenderer from "../../../../../components/chartCard/PieChartRenderer";
import StackedBarRenderer from "../../../../../components/chartCard/StackedBarRenderer";
import BarChartRenderer from "../../../../../components/chartCard/BarChartRenderer";
import {
  CONDITION_COLORS,
  RISK_COLORS,
  STATUS_COLORS,
  UTILIZATION_COLORS,
} from "../../../../../components/chartCard/chartColors";
import { getLayoutConfig } from "./constants/layoutConfig";
import { getSortConfig } from "./constants/sortConfig";
import { getFilterConfig } from "./constants/filterConfig";
import { getTableConfig } from "./constants/tableConfig";
import { getActionConfig } from "./constants/actionConfig";
import {
  Link,
  NavLink,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router";
import { useEmployee } from "../../../../../context/EmployeeContext";
import { useClient } from "../../../../../features/sales/clients/private/hooks/useClient";
import { useClientsMetadata } from "../../../../../features/sales/clients/private/hooks/useClientsMetadata";
import useClientMutations from "../../../../../features/sales/clients/private/hooks/useClientMutations";
import { fetchClients } from "../../../../../features/sales/clients/private/api/clientsService";
import ClientsList from "../../../../../components/sales/clients/clientsList/ClientsList";

/**
 * SALES Clients Management Page
 * This is private Sales clients data
 * Server-side filtering and pagination
 */
export default function ClientsManagement() {
  const queryClient = useQueryClient();
  const { darkMode } = useTheme();
  const { employee } = useEmployee();
  const navigate = useNavigate();
  const { clientId } = useParams();
  const [layout, setLayout] = useState(0); // 0: List, 1: Table
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRowId, setSelectedRowId] = useState(null);
  const [pendingDeleteRow, setPendingDeleteRow] = useState(null);
  const [modalType, setModalType] = useState(null); // "save" | "reject"
  const [pendingSaveRow, setPendingSaveRow] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);
  const [searchParams] = useSearchParams();
  const isCreating = clientId === "new";

  const [isEditing, setIsEditing] = useState(isCreating);

  useEffect(() => {
    if (isCreating) {
      setIsEditing(true);
    } else {
      setIsEditing(false);
    }
  }, [isCreating]);

  // ==============
  // HOOKS
  // ==============

  // MAIN PAGINATED DATA AND TABLE
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
  const { data: fetchedClient, isLoading: isClientLoading } =
    useClient(clientId);

  // Find selected row based on URL param.
  // If "new", return empty object for creation.
  // If not found, return null to show error state in sidebar
  const selectedRow = useMemo(() => {
    if (clientId === "new") return {};
    if (!clientId) return null;

    // 1. Check if it's already in our local paginated list (Instant UI)
    const clientInList = clients?.find((client) => client.id === clientId);
    if (clientInList) return clientInList;

    // 2. Fall back to the newly fetched client (For direct URL sharing)
    return fetchedClient || null;
  }, [clientId, clients, fetchedClient]);

  const sidebarOpen = !!selectedRow;

  // ==============
  // METADATA
  // ==============
  const {
    industries,
    isLoading: metadataLoading,
    isFetching: metadataFetching,
    error: metadataError,
  } = useClientsMetadata();
  const {
    createClient,
    updateClient,
    deleteClient,
    bulkDeleteClients,
    bulkUpdateClients,
    creating,
    updating,
    deleting,
    bulkDeleting,
    bulkUpdating,
  } = useClientMutations();

  // ==============
  // CONFIG
  // ==============
  const layoutOptions = getLayoutConfig();
  const sortOptions = getSortConfig();
  const modalConfig = getActionConfig[modalType] || {};

  // ==============
  // DATA LOADING
  // ==============
  const isLoading = clientsLoading || metadataLoading;
  const error = clientsError || metadataError;
  const isFetching = clientsFetching || metadataFetching;
  const isSaving = creating || updating || bulkUpdating;
  const hasData = clients.length > 0;

  // ==============
  // TABLE CONFIG
  // ==============
  const columns = getTableConfig({
    industries,
  });

  // ==============
  // FILTER CONFIG
  // ==============
  const filterConfig = getFilterConfig({
    industries,
  });

  // ==============
  // SIDEBAR OPEN & CLOSE
  // ==============
  function handleOpenSidebar(client) {
    setIsEditing(false);
    navigate(`/app/sales/clients/${client.id}`);
  }

  function handleCloseSidebar() {
    setIsEditing(false);
    navigate(`/app/sales/clients/list?${searchParams.toString()}`);
  }

  // ==============
  // SAVE + UPDATE
  // ==============
  function handleRequestSave(data) {
    setPendingSaveRow(data);
    setModalType("save");
    setModalOpen(true);
  }

  // ==============
  // DELETE
  // ==============
  function handleRequestDelete(client) {
    setPendingDeleteRow(client);
    setSelectedRowId(client.id);
    setModalType("delete");
    setModalOpen(true);
  }

  // ==============
  // STAGE CHANGE ACTION
  // ==============
  function handleRequestAction(action) {
    setPendingAction(action);
    setModalType(action.type);
    setModalOpen(true);
  }

  // ==============
  // CONFIRM ACTION DELETE / SAVE / UPDATE
  // ==============
  async function handleConfirmAction(reason) {
    try {
      if (modalType === "delete") {
        await deleteClient(selectedRowId);
      } else if (modalType === "save") {
        const data = pendingSaveRow;
        if (data.id) {
          await updateClient(data);
        } else {
          await createClient(data);
        }
      } else if (pendingAction) {
        const payloadToSubmit = { ...pendingAction.payload };
        await updateClient({
          id: payloadToSubmit.id,
          ...payloadToSubmit,
        });
      }

      // handleCloseSidebar();
      // setModalOpen(false);

      await queryClient.invalidateQueries({
        queryKey: ["clients"],
        exact: true,
      });

      // RESET
      handleCloseSidebar();
      setModalOpen(false);
      setPendingSaveRow(null);
      setModalType(null);
      setPendingAction(null);
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <>
      {/* SEARCH AND FILTER BAR */}
      <SearchFilterBar
        search={search}
        onSearchChange={setSearch}
        filters={filters}
        onFilterChange={setFilters}
        filterConfig={filterConfig}
        placeholder="Search companies..."
      />

      {/* ACTIVE FILTERS */}
      {hasActiveFilters && (
        <ActiveFiltersBar
          search={search}
          setSearch={setSearch}
          filters={activeFilters}
          setFilters={setFilters}
          filterConfig={filterConfig}
          resetParams={resetParams}
        />
      )}

      <PageHeader>
        {/* LAYOUT UI + ACTION BUTTONS */}
        <PageLayout
          layout={layout}
          setLayout={setLayout}
          options={layoutOptions}
          addButton={{
            name: "Add Client",
            icon: PlusCircleIcon,
            onClick: () => {
              navigate(`new?${searchParams.toString()}`);
            },
          }}
        />

        {/* SORTING ACTIONS */}
        <SortBar
          sortBy={sortBy}
          setSortBy={setSortBy}
          sortOptions={sortOptions}
          sortOrder={sortOrder}
          setSortOrder={setSortOrder}
        />
      </PageHeader>

      {/* RESULT NUMBER + NEXT AND PREVIOUS BUTTONS */}
      <PageResult
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
            onRowClick={handleOpenSidebar}
          />
        ) : (
          // LIST LAYOUT
          <CardLayout style="cardLayout1 cardPaddingSmall cardGapSmall">
            {clients.map((client) => (
              <ClientsList
                key={client.id}
                client={client}
                onClick={() => handleOpenSidebar(client)}
                saving={isSaving}
                deleting={deleting}
                setIsEditing={() => setIsEditing(true)}
              />
            ))}
          </CardLayout>
        )}
      </CardLayout>

      {/* DATA SIDEBAR */}
      <AnimatePresence>
        {sidebarOpen && (
          <DataSidebar
            title={selectedRow?.id ? "Edit Client" : "Add Client"}
            icon={PencilSimpleLineIcon}
            open={sidebarOpen}
            onClose={handleCloseSidebar}
            rowData={selectedRow}
            columns={columns}
            onSave={handleRequestSave}
            onDelete={handleRequestDelete}
            saving={isSaving}
            deleting={deleting}
            creating={!selectedRow?.id}
            isEditing={isEditing}
            onCancel={() => setIsEditing(false)}
            fullPage
          ></DataSidebar>
        )}
      </AnimatePresence>

      <ActionModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setModalType(null);
          setPendingAction(null); // Kills the zombie state
        }}
        title={modalConfig.title}
        description={modalConfig.description}
        confirmText={modalConfig.confirmText}
        loading={isSaving || deleting}
        onConfirm={handleConfirmAction}
        modalType={modalConfig.modalType}
      />
    </>
  );
}
