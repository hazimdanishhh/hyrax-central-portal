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
import LeadsList from "../../../../../components/sales/leads/leadsList/LeadsList";
import LeadSidebar from "../../../../../components/sales/leads/leadSidebar/LeadSidebar";
import { LEAD_ACTION_MODAL_CONFIG } from "./constants/leadActionModal";
import {
  Link,
  NavLink,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router";
import { useEmployee } from "../../../../../context/EmployeeContext";
import LeadStageTab from "../../../../../components/sales/leads/leadStageTab/LeadStageTab";
import { stageTabsConfig } from "./tabConfig";
import { useLead } from "../../../../../features/sales/leads/private/hooks/useLead";

/**
 * SALES Leads Management Page
 * This is private Sales leads data
 * Server-side filtering and pagination
 */
export default function LeadsManagement() {
  const queryClient = useQueryClient();
  const { darkMode } = useTheme();
  const { employee } = useEmployee();
  const navigate = useNavigate();
  const { leadId } = useParams();
  const [layout, setLayout] = useState(0); // 0: List, 1: Table
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRowId, setSelectedRowId] = useState(null);
  const [pendingDeleteRow, setPendingDeleteRow] = useState(null);
  const [modalType, setModalType] = useState(null); // "save" | "reject"
  const [pendingSaveRow, setPendingSaveRow] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);
  const [searchParams] = useSearchParams();
  const currentStage = searchParams.get("stage");
  const isCancelled = searchParams.get("cancelled") === "true";
  const isOnHold = searchParams.get("onHold") === "true";
  const [isEditing, setIsEditing] = useState(false);

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
  const { data: fetchedLead, isLoading: isLeadLoading } = useLead(leadId);

  // Find selected row based on URL param.
  // If "new", return empty object for creation.
  // If not found, return null to show error state in sidebar
  const selectedRow = useMemo(() => {
    if (leadId === "new") return {};
    if (!leadId) return null;

    // 1. Check if it's already in our local paginated list (Instant UI)
    const leadInList = leads?.find((lead) => lead.id === leadId);
    if (leadInList) return leadInList;

    // 2. Fall back to the newly fetched lead (For direct URL sharing)
    return fetchedLead || null;
  }, [leadId, leads, fetchedLead]);

  const sidebarOpen = !!selectedRow;

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
    employee,
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
    navigate(`${lead.id}?${searchParams.toString()}`);
  }

  function handleCloseSidebar() {
    setIsEditing(false);
    navigate(`/app/sales/leads/list?${searchParams.toString()}`);
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
  // MODAL INPUT CONFIG
  // ==============
  const isHoldAction =
    pendingAction?.type === "toggle_hold" &&
    pendingAction?.payload?.is_on_hold === true;
  const isLostAction =
    pendingAction?.type === "stage_change" &&
    pendingAction?.payload?.stage === "LOST";
  const isCancelAction = pendingAction?.type === "cancel";

  const requireInput = isHoldAction || isLostAction || isCancelAction;

  let dynamicPlaceholder = "Enter reason...";
  if (isHoldAction) dynamicPlaceholder = "Why is this lead on hold?";
  if (isLostAction) dynamicPlaceholder = "Why was this lead lost?";
  if (isCancelAction) dynamicPlaceholder = "Why is this lead being cancelled?";

  // ==============
  // CONFIRM ACTION DELETE / SAVE / UPDATE
  // ==============
  async function handleConfirmAction(reason) {
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
        const payloadToSubmit = { ...pendingAction.payload };

        // Map the typed reason to the correct database column
        if (isCancelAction) payloadToSubmit.cancel_reason = reason;
        if (isHoldAction) payloadToSubmit.hold_reason = reason;
        if (isLostAction) payloadToSubmit.lose_reason = reason;

        // Clear the reason if they are reverting the state
        if (
          pendingAction.type === "toggle_hold" &&
          !pendingAction.payload.is_on_hold
        ) {
          payloadToSubmit.hold_reason = null;
        }
        if (
          pendingAction.type === "stage_change" &&
          pendingAction.payload.stage !== "LOST"
        ) {
          payloadToSubmit.lose_reason = null;
        }

        // FIX: Pass payloadToSubmit instead of pendingAction.payload
        await updateLead({
          id: payloadToSubmit.id,
          ...payloadToSubmit,
        });
      }

      await queryClient.invalidateQueries({
        queryKey: ["sales_leads"],
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
                navigate(`new?${searchParams.toString()}`);
                setIsEditing(true);
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

        <div className="stageTab scrollbar">
          {stageTabsConfig(currentStage, isCancelled, isOnHold).map((tab) => (
            <LeadStageTab
              key={tab.label}
              to={tab.to}
              label={tab.label}
              themeType={tab.themeType}
              isActive={tab.isActive}
            />
          ))}
        </div>

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
                  setIsEditing={() => setIsEditing(true)}
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
            isEditing={isEditing}
          >
            {selectedRow?.id && (
              <LeadSidebar
                selectedRow={selectedRow}
                onRequestAction={handleRequestLeadAction}
                isEditing={isEditing}
                setIsEditing={setIsEditing}
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
        requireInput={requireInput}
        inputPlaceholder={dynamicPlaceholder}
      />
    </>
  );
}
