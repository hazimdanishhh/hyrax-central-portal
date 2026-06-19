// pages/user/it/ITAssetManagement/list/ITAssetManagement.jsx
import { PencilSimpleLineIcon, PlusCircleIcon } from "@phosphor-icons/react";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import CardLayout from "../../../../../components/cardLayout/CardLayout";
import ActiveFiltersBar from "../../../../../components/crud/activeFiltersBar/ActiveFiltersBar";
import NoResult from "../../../../../components/crud/noResult/NoResult";
import PageActions from "../../../../../components/crud/pageActions/PageActions";
import PageHeader from "../../../../../components/crud/pageHeader/PageHeader";
import PageResult from "../../../../../components/crud/pageResult/PageResult";
import SortBar from "../../../../../components/crud/sortBar/SortBar";
import DataSidebar from "../../../../../components/dataSidebar/DataSidebar";
import DataTable from "../../../../../components/dataTable/DataTable";
import LoadingIcon from "../../../../../components/loadingIcon/LoadingIcon";
import ActionModal from "../../../../../components/modals/actionModal/ActionModal";
import LeadSidebar from "../../../../../components/sales/leads/leadSidebar/LeadSidebar";
import LeadsList from "../../../../../components/sales/leads/leadsList/LeadsList";
import LeadStageTab from "../../../../../components/sales/leads/leadStageTab/LeadStageTab";
import SearchFilterBar from "../../../../../components/searchFilterBar/SearchFilterBar";
import { useEmployee } from "../../../../../context/EmployeeContext";
import { useTheme } from "../../../../../context/ThemeContext";
import { fetchLeads } from "../../../../../features/sales/leads/private/api/leadsService";
import { useLead } from "../../../../../features/sales/leads/private/hooks/useLead";
import useLeadMutations from "../../../../../features/sales/leads/private/hooks/useLeadMutations";
import { useLeadsMetadata } from "../../../../../features/sales/leads/private/hooks/useLeadsMetadata";
import usePaginatedQuery from "../../../../../hooks/usePaginatedQuery";
import { getActionConfig } from "./constants/actionConfig";
import { getFilterConfig } from "./constants/filterConfig";
import { getLayoutConfig } from "./constants/layoutConfig";
import { getSortConfig } from "./constants/sortConfig";
import { stageTabsConfig } from "./constants/tabConfig";
import { leadsTableConfig } from "./constants/tableConfig";
import "./LeadsManagement.scss";

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
  const isCreating = leadId === "new";

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
    defaultSortBy: "updated_at",
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
  const modalConfig = getActionConfig[modalType] || {};

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
  function handleRequestAction(action) {
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
  const isNegotiationAction =
    pendingAction?.type === "stage_change" &&
    pendingAction?.payload?.stage === "NEGOTIATION";
  const isWonAction =
    pendingAction?.type === "stage_change" &&
    pendingAction?.payload?.stage === "WON";

  const requireInput = isHoldAction || isLostAction || isCancelAction;

  let dynamicPlaceholder = "Enter reason...";
  if (isHoldAction) dynamicPlaceholder = "Why is this lead on hold?";
  if (isLostAction) dynamicPlaceholder = "Why was this lead lost?";
  if (isCancelAction) dynamicPlaceholder = "Why is this lead being cancelled?";

  // ==============
  // CONFIRM ACTION DELETE / SAVE / UPDATE
  // ==============
  // CHANGE: Parameter is now `formValues` object instead of just `reason`
  async function handleConfirmAction(formValues) {
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

        // Map the typed reason (from formValues.reason)
        if (isCancelAction) payloadToSubmit.cancel_reason = formValues.reason;
        if (isHoldAction) payloadToSubmit.hold_reason = formValues.reason;
        if (isLostAction) payloadToSubmit.lose_reason = formValues.reason;

        // MAP THE NEW STAGE DATA
        if (isNegotiationAction) {
          payloadToSubmit.quotation_url = formValues.quotation_url;
        }

        if (isWonAction) {
          payloadToSubmit.po_number = formValues.po_number;
          payloadToSubmit.po_document_url = formValues.po_document_url;
          payloadToSubmit.actual_revenue = formValues.actual_revenue;
        }

        // =========================
        // CLEAR HOLD STATE
        // =========================
        if (
          pendingAction.type === "toggle_hold" &&
          !pendingAction.payload.is_on_hold
        ) {
          payloadToSubmit.hold_reason = null;
        }

        if (pendingAction.type === "cancel") {
          payloadToSubmit.is_on_hold = false;
          payloadToSubmit.hold_reason = null;
        }

        // =========================
        // CLEAR LOST REASON
        // =========================
        if (
          pendingAction.type === "stage_change" &&
          pendingAction.payload.stage !== "LOST"
        ) {
          payloadToSubmit.lose_reason = null;
        }

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
      {/* SEARCH AND FILTER BAR */}
      <SearchFilterBar
        search={search}
        onSearchChange={setSearch}
        filters={filters}
        onFilterChange={setFilters}
        filterConfig={filterConfig}
        placeholder="Search leads..."
        enableDateRange
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
        <PageActions
          layout={layout}
          setLayout={setLayout}
          options={layoutOptions}
          actionButtons={[
            {
              icon: PlusCircleIcon,
              name: "Add Lead",
              onClick: () => {
                navigate(`new?${searchParams.toString()}`);
              },
              style: "button buttonType5 approval textXXS",
            },
            {
              icon: PlusCircleIcon,
              name: "Add Client",
              onClick: () => {
                navigate(`../../clients/list/new`);
              },
              style: "button buttonType5 approval textXXS",
            },
          ]}
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
        ) : !hasData ? (
          <NoResult />
        ) : error ? (
          <NoResult title="Error loading results" />
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
            onCancel={() => setIsEditing(false)}
          >
            {selectedRow?.id && !isEditing && (
              <LeadSidebar
                selectedRow={selectedRow}
                onRequestAction={handleRequestAction}
                isEditing={isEditing}
                setIsEditing={setIsEditing}
              />
            )}
          </DataSidebar>
        )}
      </AnimatePresence>

      <ActionModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setModalType(null);
          setPendingAction(null);
        }}
        title={modalConfig.title}
        description={modalConfig.description}
        confirmText={modalConfig.confirmText}
        loading={isSaving || deleting}
        onConfirm={handleConfirmAction}
        modalType={modalConfig.modalType}
        requireInput={requireInput}
        inputPlaceholder={dynamicPlaceholder}
        // ADD THESE TWO PROPS
        requireQuotation={isNegotiationAction}
        requireWonDetails={isWonAction}
      />
    </>
  );
}
