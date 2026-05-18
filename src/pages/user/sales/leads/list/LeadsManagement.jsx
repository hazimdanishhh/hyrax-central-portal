// pages/user/it/ITAssetManagement/list/ITAssetManagement.jsx
import {
  CheckCircleIcon,
  DesktopIcon,
  PencilSimpleLineIcon,
  PlusCircleIcon,
  UserMinusIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import CardLayout from "../../../../../components/cardLayout/CardLayout";
import LoadingIcon from "../../../../../components/loadingIcon/LoadingIcon";
import { useTheme } from "../../../../../context/ThemeContext";
import "./LeadsManagement.scss";
import { useMemo, useState } from "react";
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
import { fetchLeads } from "../../../../../features/sales/leads/private/api/leadsService";
import { useLeadsMetadata } from "../../../../../features/sales/leads/private/hooks/useLeadsMetadata";
import useLeadMutations from "../../../../../features/sales/leads/private/hooks/useLeadMutations";
import { getLayoutConfig } from "./layoutConfig";
import { getSortConfig } from "./sortConfig";
import { getFilterConfig } from "./filterConfig";
import { leadsTableConfig } from "./tableConfig";
import LeadsList from "../../../../../components/sales/leads/LeadList/LeadsList";
import LeadSidebar from "../../../../../components/sales/leads/leadSidebar/LeadSidebar";
import { LEAD_ACTION_MODAL_CONFIG } from "../../../../../data/constants/leadActionModal";

/**
 * SALES Leads Management Page
 * This is private Sales leads data
 * Server-side filtering and pagination
 */
export default function LeadsManagement() {
  const queryClient = useQueryClient();
  const { darkMode } = useTheme();
  const [layout, setLayout] = useState(0); // 0: List, 1: Table
  const [selectedRow, setSelectedRow] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRowId, setSelectedRowId] = useState(null);
  const [pendingDeleteRow, setPendingDeleteRow] = useState(null);
  const [modalType, setModalType] = useState(null); // "save" | "reject"
  const [pendingSaveRow, setPendingSaveRow] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);

  // ==============
  // HOOKS
  // ==============

  // MAIN PAGINATED DATA AND TABLE
  const {
    data: leads,
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
    isLoading: leadsLoading,
    isFetching: leadsFetching,
    error: leadsError,
  } = usePaginatedQuery({
    queryKey: "sales_leads",
    queryFn: fetchLeads,
    pageSize: 20,
    defaultSortBy: "created_at",
    defaultSortOrder: "descending",
  });

  // ==============
  // METADATA
  // ==============
  const {
    owners,
    clients,
    clientContacts,
    leadSourceTypes,
    isLoading: metadataLoading,
    isFetching: metadataFetching,
    error: metadataError,
  } = useLeadsMetadata();
  const {
    createLead,
    updateLead,
    deleteLead,
    bulkDeleteLeads,
    bulkUpdateLeads,
    creating,
    updating,
    deleting,
    bulkDeleting,
    bulkUpdating,
  } = useLeadMutations();

  // ==============
  // CONFIG
  // ==============
  const layoutOptions = getLayoutConfig();
  const sortOptions = getSortConfig();
  const modalConfig = LEAD_ACTION_MODAL_CONFIG[modalType] || {};

  // ==============
  // DATA LOADING
  // ==============
  const isLoading = leadsLoading || metadataLoading;
  const error = leadsError || metadataError;
  const isFetching = leadsFetching || metadataFetching;
  const isSaving = creating || updating || bulkUpdating;
  const hasData = leads.length > 0;

  // ==============
  // TABLE CONFIG
  // ==============
  const columns = leadsTableConfig({
    owners,
    clients,
    clientContacts,
    leadSourceTypes,
  });

  // ==============
  // FILTER CONFIG
  // ==============
  const filterConfig = getFilterConfig({
    owners,
    clients,
    clientContacts,
    leadSourceTypes,
  });

  // ==============
  // SIDEBAR OPEN & CLOSE
  // ==============
  function handleOpenSidebar(lead) {
    setSelectedRow(lead);
    setSidebarOpen(true);
  }

  function handleCloseSidebar() {
    setSidebarOpen(false);
    setSelectedRow(null);
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
  function handleRequestDelete(lead) {
    setPendingDeleteRow(lead);
    setSelectedRowId(lead.id);
    setModalType("delete");
    setModalOpen(true);
  }

  // ==============
  // STAGE CHANGE ACTION
  // ==============
  function handleRequestLeadAction(action) {
    setPendingAction(action);
    setModalType(action.type);
    setModalOpen(true);
  }

  // ==============
  // CONFIRM ACTION DELETE / SAVE / UPDATE
  // ==============
  async function handleConfirmAction() {
    try {
      // DELETE
      if (modalType === "delete") {
        await deleteLead(selectedRowId);
      }

      // SAVE
      if (modalType === "save") {
        const data = pendingSaveRow;

        if (data.id) {
          await updateLead(data);
        } else {
          await createLead(data);
        }
      }

      // ACTIONS
      if (pendingAction) {
        await updateLead({
          id: pendingAction.payload.id,
          ...pendingAction.payload,
        });
      }

      await queryClient.invalidateQueries({
        queryKey: ["sales_leads"],
      });

      // RESET
      setModalOpen(false);
      setSidebarOpen(false);
      setSelectedRow(null);
      setPendingSaveRow(null);
      setModalType(null);
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <>
      {/* TABLE LIST TAB */}
      <>
        {/* SEARCH AND FILTER BAR */}
        <SearchFilterBar
          search={search}
          onSearchChange={setSearch}
          filters={filters}
          onFilterChange={setFilters}
          filterConfig={filterConfig}
          placeholder="Search assets..."
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
              name: "Add Lead",
              icon: PlusCircleIcon,
              onClick: () => {
                setSelectedRow({});
                setSidebarOpen(true);
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
          data={leads}
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
          ) : !hasData || error ? (
            <NoResult />
          ) : layout === 1 ? (
            // TABLE LAYOUT
            <DataTable
              data={leads}
              columns={columns}
              rowKey="id"
              onRowClick={handleOpenSidebar}
            />
          ) : (
            // LIST LAYOUT
            <CardLayout style="cardLayout2 cardPaddingSmall cardGapSmall">
              {leads.map((lead) => (
                <LeadsList
                  key={lead.id}
                  lead={lead}
                  onClick={() => handleOpenSidebar(lead)}
                  saving={isSaving}
                  deleting={deleting}
                />
              ))}
            </CardLayout>
          )}
        </CardLayout>
      </>

      {/* DATA SIDEBAR */}
      <AnimatePresence>
        {sidebarOpen && (
          <DataSidebar
            title={selectedRow?.id ? "Edit Lead" : "Add Lead"}
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
          >
            {selectedRow?.id && (
              <LeadSidebar
                selectedRow={selectedRow}
                onRequestAction={handleRequestLeadAction}
              />
            )}
          </DataSidebar>
        )}
      </AnimatePresence>

      <ActionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
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
