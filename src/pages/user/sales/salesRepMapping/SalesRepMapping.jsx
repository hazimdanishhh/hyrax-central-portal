import { useState } from "react";
import { useTheme } from "../../../../context/ThemeContext";
import usePaginatedQuery from "../../../../hooks/usePaginatedQuery";
import useCrudActionState from "../../../../hooks/useCrudActionState";
import { fetchSalesRepMappings } from "../../../../features/sales/salesRepMapping/private/api/salesRepMappingService";
import useSalesRepMappingMutations from "../../../../features/sales/salesRepMapping/private/hooks/useSalesRepMappingMutations";
import CardLayout from "../../../../components/cardLayout/CardLayout";
import { LinkIcon, PencilSimpleLineIcon } from "@phosphor-icons/react";
import { getSalesRepMappingSortConfig } from "./sortConfig";
import { salesRepMappingTableConfig } from "./tableConfig";
import { getSalesRepMappingFilterConfig } from "./filterConfig";
import { getSalesRepMappingLayoutConfig } from "./layoutConfig";
import Breadcrumbs from "../../../../components/breadcrumbs/Breadcrumbs";
import CardWrapper from "../../../../components/cardWrapper/CardWrapper";
import SearchFilterBar from "../../../../components/searchFilterBar/SearchFilterBar";
import PageHeader from "../../../../components/crud/pageHeader/PageHeader";
import PageActions from "../../../../components/crud/pageActions/PageActions";
import SortBar from "../../../../components/crud/sortBar/SortBar";
import ActiveFiltersBar from "../../../../components/crud/activeFiltersBar/ActiveFiltersBar";
import PageResult from "../../../../components/crud/pageResult/PageResult";
import LoadingIcon from "../../../../components/loadingIcon/LoadingIcon";
import NoResult from "../../../../components/crud/noResult/NoResult";
import DataTable from "../../../../components/dataTable/DataTable";
import { AnimatePresence } from "framer-motion";
import DataSidebar from "../../../../components/dataSidebar/DataSidebar";
import ActionModal from "../../../../components/modals/actionModal/ActionModal";
import SalesRepMappingList from "../../../../components/sales/salesRepMapping/salesRepMappingList/SalesRepMappingList";

/**
 * Links a SAP sales rep (sap_sales_persons, auto-populated off OSLP) to a
 * real employee. Rows themselves are trigger-managed
 * (auto_create_sales_rep_mapping.sql) -- this page only ever updates
 * employee_id, never creates/deletes a row. See DASHBOARD-ROADMAP.md §1.1.
 */
export default function SalesRepMapping() {
  const { darkMode } = useTheme();
  const [layout, setLayout] = useState(2); // 1: Card, 2: Table
  const [selectedRow, setSelectedRow] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const {
    modalOpen,
    modalType,
    pendingSaveRow,
    handleRequestSave,
    closeActionModal,
  } = useCrudActionState();

  // MAIN PAGINATED DATA AND TABLE
  const {
    data: mappings,
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
    isLoading,
    isFetching,
    error,
  } = usePaginatedQuery({
    queryKey: "sales_rep_mappings",
    queryFn: fetchSalesRepMappings,
    pageSize: 20,
    defaultSortBy: "sales_rep_name",
  });

  const { updateSalesRepMapping, updating } = useSalesRepMappingMutations();

  const layoutOptions = getSalesRepMappingLayoutConfig();
  const sortOptions = getSalesRepMappingSortConfig();
  const columns = salesRepMappingTableConfig();
  const filterConfig = getSalesRepMappingFilterConfig();

  const hasData = mappings.length > 0;

  function handleOpenSidebar(data) {
    setSelectedRow(data);
    setSidebarOpen(true);
  }

  function handleCloseSidebar() {
    setSidebarOpen(false);
    setSelectedRow(null);
  }

  async function handleConfirmAction() {
    try {
      if (modalType === "save") {
        await updateSalesRepMapping({
          sales_rep_code: selectedRow.sales_rep_code,
          employee_id: pendingSaveRow.employee_id || null,
        });
      }

      handleCloseSidebar();
      closeActionModal();
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <section className={darkMode ? "sectionDark" : "sectionLight"}>
      <div className="sectionWrapper">
        <div className="sectionContent">
          <Breadcrumbs icon={LinkIcon} current="Sales Rep Mapping" />

          <CardWrapper>
            {/* SEARCH AND FILTER BAR */}
            <SearchFilterBar
              search={search}
              onSearchChange={setSearch}
              filters={filters}
              onFilterChange={setFilters}
              filterConfig={filterConfig}
              placeholder="Search sales rep mapping..."
            />

            <PageHeader>
              {/* LAYOUT UI */}
              <PageActions
                layout={layout}
                setLayout={setLayout}
                options={layoutOptions}
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

            {/* RESULT NUMBER + NEXT AND PREVIOUS BUTTONS */}
            <PageResult
              data={mappings}
              totalCount={totalCount}
              page={page}
              setPage={setPage}
              totalPages={totalPages}
              error={error}
            />

            {/* TABLE/CARD DISPLAY UI */}
            <div className="cardWrapperScroll">
              {isLoading || isFetching ? (
                <CardLayout style="cardLayoutFlexFull">
                  <LoadingIcon />
                </CardLayout>
              ) : !hasData ? (
                <NoResult />
              ) : layout === 1 ? (
                // TABLE LAYOUT
                <DataTable
                  data={mappings}
                  columns={columns}
                  rowKey="sales_rep_code"
                  onRowClick={handleOpenSidebar}
                />
              ) : (
                // LIST LAYOUT
                <CardLayout style="cardLayout1 cardPaddingSmall cardGapSmall">
                  {mappings.map((mapping) => (
                    <SalesRepMappingList
                      key={mapping.sales_rep_code}
                      mapping={mapping}
                      onClick={() => handleOpenSidebar(mapping)}
                    />
                  ))}
                </CardLayout>
              )}
            </div>

            {/* DATA SIDEBAR */}
            <AnimatePresence>
              {sidebarOpen && (
                <DataSidebar
                  title="Edit Sales Rep Mapping"
                  icon={PencilSimpleLineIcon}
                  open={sidebarOpen}
                  onClose={handleCloseSidebar}
                  rowData={selectedRow}
                  columns={columns}
                  onSave={handleRequestSave}
                  saving={updating}
                  hideDelete
                >
                  {/* No children -- DataForm handles read-only + the one
                      editable field. */}
                </DataSidebar>
              )}
            </AnimatePresence>

            {/* ACTION MODAL */}
            <ActionModal
              open={modalOpen}
              onClose={closeActionModal}
              title="Save Sales Rep Mapping"
              description="Are you sure you want to save these changes?"
              confirmText="Save"
              loading={updating}
              onConfirm={handleConfirmAction}
              modalType={modalType}
            />
          </CardWrapper>
        </div>
      </div>
    </section>
  );
}
