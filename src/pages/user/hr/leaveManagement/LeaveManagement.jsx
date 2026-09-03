// pages/user/hr/leaveManagement/LeaveManagement.jsx
import { useState } from "react";
import {
  CalendarIcon,
  UploadSimpleIcon,
  InfoIcon,
} from "@phosphor-icons/react";
import { AnimatePresence } from "framer-motion";
import { useTheme } from "../../../../context/ThemeContext";
import Breadcrumbs from "../../../../components/breadcrumbs/Breadcrumbs";
import CardWrapper from "../../../../components/cardWrapper/CardWrapper";
import CardLayout from "../../../../components/cardLayout/CardLayout";
import LoadingIcon from "../../../../components/loadingIcon/LoadingIcon";
import NoResult from "../../../../components/crud/noResult/NoResult";
import PageHeader from "../../../../components/crud/pageHeader/PageHeader";
import PageActions from "../../../../components/crud/pageActions/PageActions";
import PageResult from "../../../../components/crud/pageResult/PageResult";
import SortBar from "../../../../components/crud/sortBar/SortBar";
import ActiveFiltersBar from "../../../../components/crud/activeFiltersBar/ActiveFiltersBar";
import SearchFilterBar from "../../../../components/searchFilterBar/SearchFilterBar";
import DataTable from "../../../../components/dataTable/DataTable";
import DataSidebar from "../../../../components/dataSidebar/DataSidebar";
import CsvImportModal from "../../../../components/crud/csvImportModal/CsvImportModal";
import usePaginatedQuery from "../../../../hooks/usePaginatedQuery";
import { fetchLeaveRecords } from "../../../../features/hr/leave/private/api/leaveRecordsService";
import useLeaveLedgerTypes from "../../../../features/hr/leave/private/hooks/useLeaveLedgerTypes";
import useLeaveImportMutation from "../../../../features/hr/leave/private/hooks/useLeaveImportMutation";
import { leaveRecordsTableConfig } from "./tableConfig";
import { getLeaveRecordsFilterConfig } from "./filterConfig";
import { getLeaveRecordsSortConfig } from "./sortConfig";
import { getLeaveCsvImportConfig } from "./leaveCsvImportConfig";
import "./LeaveManagement.scss";
import LeaveCard from "../../../../components/hr/leaveCard/LeaveCard";

/**
 * HR Leave Management page. Read-only: leave_ledger_entries is populated
 * exclusively by the weekly HR2000 CSV sync (see leaveCsvImportConfig.js /
 * sync_leave_ledger_from_snapshot) -- HR2000 remains the system of record
 * for leave, so no per-row create/edit/delete is offered here; any manual
 * edit would just be discarded on the next sync.
 */
export default function LeaveManagement() {
  const { darkMode } = useTheme();
  const [importOpen, setImportOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { leaveTypes } = useLeaveLedgerTypes();
  const { runImport } = useLeaveImportMutation();

  const {
    data: records,
    totalCount,
    page,
    totalPages,
    search,
    filters,
    sortBy,
    sortOrder,
    activeFilters,
    hasActiveFilters,
    setSearch,
    setFilters,
    setSortBy,
    setSortOrder,
    setPage,
    resetParams,
    isLoading,
    isFetching,
    error,
  } = usePaginatedQuery({
    queryKey: "leave_records",
    queryFn: fetchLeaveRecords,
    pageSize: 25,
    defaultSortBy: "leave_date",
    defaultSortOrder: "descending",
  });
  const columns = leaveRecordsTableConfig();
  const filterConfig = getLeaveRecordsFilterConfig({ leaveTypes });
  const sortOptions = getLeaveRecordsSortConfig();

  const importConfig = getLeaveCsvImportConfig({
    runImport,
    onImported: () => setImportOpen(false),
  });

  const hasData = records.length > 0;

  function handleRowClick(row) {
    setSelectedRow(row);
    setSidebarOpen(true);
  }

  function handleCloseSidebar() {
    setSidebarOpen(false);
    setSelectedRow(null);
  }

  return (
    <section className={darkMode ? "sectionDark" : "sectionLight"}>
      <div className="sectionWrapper">
        <div className="sectionContent">
          <Breadcrumbs icon={CalendarIcon} current="Leave Management" />

          <CardWrapper>
            <SearchFilterBar
              search={search}
              onSearchChange={setSearch}
              filters={filters}
              onFilterChange={setFilters}
              filterConfig={filterConfig}
              placeholder="Search by employee code or remarks..."
              enableDateRange
            />

            <PageHeader>
              <PageActions
                actionButtons={[
                  {
                    name: "Import Leave CSV",
                    icon: UploadSimpleIcon,
                    onClick: () => setImportOpen(true),
                    style: "button buttonType5 approval",
                  },
                ]}
              />

              <SortBar
                sortBy={sortBy}
                setSortBy={setSortBy}
                sortOptions={sortOptions}
                sortOrder={sortOrder}
                setSortOrder={setSortOrder}
              />
            </PageHeader>

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

            <PageResult
              data={records}
              totalCount={totalCount}
              page={page}
              setPage={setPage}
              totalPages={totalPages}
              error={error}
            />

            <div className="cardWrapperScroll">
              {isLoading || isFetching ? (
                <CardLayout style="cardLayoutFlexFull">
                  <LoadingIcon />
                </CardLayout>
              ) : !hasData ? (
                <NoResult
                  title={
                    hasActiveFilters
                      ? "No leave records match these filters."
                      : "No leave data yet -- import the HR2000 CSV export to get started."
                  }
                />
              ) : (
                <CardLayout style="cardLayout1 cardGapSmall">
                  {records.map((leave) => (
                    <LeaveCard
                      key={leave.id}
                      leave={leave}
                      onClick={() => handleRowClick(leave)}
                    />
                  ))}
                </CardLayout>
              )}
            </div>
          </CardWrapper>
        </div>
      </div>

      {/* READ-ONLY ROW DETAIL -- no edit/delete; HR2000 is the system of
          record and any manual edit here would be discarded on the next
          weekly sync. */}
      <AnimatePresence>
        {sidebarOpen && (
          <DataSidebar
            title="Leave Record"
            icon={InfoIcon}
            open={sidebarOpen}
            onClose={handleCloseSidebar}
            isEditing={false}
          >
            {selectedRow && (
              <CardLayout style="cardLayout1 cardGapSmall">
                <DetailRow
                  label="Employee"
                  value={
                    selectedRow.employee?.full_name || selectedRow.employee_code
                  }
                />
                <DetailRow
                  label="Employee Code"
                  value={selectedRow.employee_code}
                />
                <DetailRow label="Date" value={selectedRow.leave_date} />
                <DetailRow
                  label="Type"
                  value={
                    selectedRow.leave_type?.label || selectedRow.leave_type_code
                  }
                />
                <DetailRow label="Days" value={selectedRow.day_fraction} />
                <DetailRow
                  label="Remarks"
                  value={selectedRow.remarks || "--"}
                />
                <DetailRow
                  label="Last Synced"
                  value={
                    selectedRow.last_seen_at
                      ? new Date(selectedRow.last_seen_at).toLocaleString()
                      : "--"
                  }
                />
              </CardLayout>
            )}
          </DataSidebar>
        )}
      </AnimatePresence>

      <CsvImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import Leave CSV"
        icon={UploadSimpleIcon}
        config={importConfig}
      />
    </section>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="leaveDetailRow">
      <p className="textBold textXXS">{label}</p>
      <p className="textRegular textXS">{value}</p>
    </div>
  );
}
