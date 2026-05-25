import { PlusCircleIcon } from "@phosphor-icons/react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import CardLayout from "../../../../../components/cardLayout/CardLayout";
import CrudFunctions from "../../../../../components/crud/crudFunctions/CrudFunctions";
import NoResult from "../../../../../components/crud/noResult/NoResult";
import DataTable from "../../../../../components/dataTable/DataTable";
import LoadingIcon from "../../../../../components/loadingIcon/LoadingIcon";
import LeadsList from "../../../../../components/sales/leads/leadsList/LeadsList";
import LeadStageTab from "../../../../../components/sales/leads/leadStageTab/LeadStageTab";
import { useModal } from "../../../../../context/ActionModalContext";
import { useEmployee } from "../../../../../context/EmployeeContext";
import { useSidebar } from "../../../../../context/SidebarContext";
import { useTheme } from "../../../../../context/ThemeContext";
import { fetchLeads } from "../../../../../features/sales/leads/private/api/leadsService";
import { useLeadsMetadata } from "../../../../../features/sales/leads/private/hooks/useLeadsMetadata";
import usePaginatedQuery from "../../../../../hooks/usePaginatedQuery";
import { getFilterConfig } from "./constants/filterConfig";
import { getLayoutConfig } from "./constants/layoutConfig";
import { getSortConfig } from "./constants/sortConfig";
import { stageTabsConfig } from "./constants/tabConfig";
import { leadsTableConfig } from "./constants/tableConfig";
import { useLeadHandlers } from "./constants/useLeadHandlers";
import "./LeadsManagement.scss";

/**
 * SALES Leads Management Page
 * This is private Sales leads data
 * Server-side filtering and pagination
 */
export default function LeadsManagement() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { darkMode } = useTheme();
  const { employee } = useEmployee();
  const { leadId } = useParams();

  // 1. IMPORT CONTEXTS
  const { sidebar, openSidebar, updateSidebar, closeSidebar } = useSidebar();
  const { openModal } = useModal();

  const [searchParams] = useSearchParams();
  const [layout, setLayout] = useState(0);

  const currentStage = searchParams.get("stage");
  const isCancelled = searchParams.get("cancelled") === "true";
  const isOnHold = searchParams.get("onHold") === "true";

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

  // ==============
  // CONFIG
  // ==============
  const columns = leadsTableConfig({
    employee,
    owners,
    clients,
    clientContacts,
    leadSourceTypes,
  });
  const filterConfig = getFilterConfig({
    owners,
    clients,
    clientContacts,
    leadSourceTypes,
  });
  const layoutOptions = getLayoutConfig();
  const sortOptions = getSortConfig();

  // ==============
  // DATA LOADING
  // ==============
  const isLoading = leadsLoading || metadataLoading;
  const error = leadsError || metadataError;
  const isFetching = leadsFetching || metadataFetching;
  const hasData = leads.length > 0;

  // ==============
  // BUSINESS LOGIC & MUTATIONS
  // ==============
  const { handleCreate, handleEdit, isSaving, deleting } = useLeadHandlers({
    columns,
  });

  // ==============
  // DIRECT URL ACCESS (Open Sidebar automatically)
  // ==============
  useEffect(() => {
    if (isLoading || !leadId || sidebar.open) return;

    if (leadId === "new") {
      handleCreate();
    } else {
      const existingLead = leads?.find((l) => l.id === leadId);
      if (existingLead) {
        handleEdit(existingLead, false); // Open in view mode
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId, isLoading]);

  // ==============
  // SYNC SIDEBAR STATE
  // ==============
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
            icon: PlusCircleIcon,
            name: "Add Lead",
            onClick: () => handleCreate(),
            style: "button buttonType5 approval textXXS",
          },
          {
            icon: PlusCircleIcon,
            name: "Add Client",
            onClick: () => navigate(`../../clients/list/new`),
            style: "button buttonType5 approval textXXS",
          },
        ]}
        sortBy={sortBy}
        setSortBy={setSortBy}
        sortOptions={sortOptions}
        sortOrder={sortOrder}
        setSortOrder={setSortOrder}
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
            onRowClick={(lead) => handleEdit(lead, false)}
          />
        ) : (
          // LIST LAYOUT
          <CardLayout style="cardLayout2 cardPaddingSmall cardGapSmall">
            {leads.map((lead) => (
              <LeadsList
                key={lead.id}
                lead={lead}
                onClick={() => handleEdit(lead, false)}
                saving={isSaving}
                deleting={deleting}
                onEdit={() => handleEdit(lead, true)}
              />
            ))}
          </CardLayout>
        )}
      </CardLayout>
    </>
  );
}
