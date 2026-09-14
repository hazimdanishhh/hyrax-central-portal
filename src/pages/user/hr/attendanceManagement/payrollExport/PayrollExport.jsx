// pages/user/hr/attendanceManagement/payrollExport/PayrollExport.jsx
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import CardLayout from "@/components/cardLayout/CardLayout";
import LoadingIcon from "@/components/loadingIcon/LoadingIcon";
import NoResult from "@/components/crud/noResult/NoResult";
import SearchFilterBar from "@/components/searchFilterBar/SearchFilterBar";
import PayrollCycleFilterBar from "@/components/payrollCycleFilterBar/PayrollCycleFilterBar";
import DataTable from "@/components/dataTable/DataTable";
import DataSidebar from "@/components/dataSidebar/DataSidebar";
import PayrollReconciliationSidebar from "@/components/attendance/payrollReconciliationSidebar/PayrollReconciliationSidebar";
import { useAttendanceActivitiesMetadata } from "@/features/hr/attendance/private/hooks/useAttendanceActivitiesMetadata";
import usePayrollPeriodSummary from "@/features/hr/payroll/private/hooks/usePayrollPeriodSummary";
import {
  getPayrollExportFilterConfig,
  rowNeedsReconciliation,
} from "./filterConfig";
import { payrollPeriodSummaryTableConfig } from "./tableConfig";
import { payrollPeriodSummaryExportColumns } from "./exportConfig";

/**
 * Payroll Export tab -- the "Payroll Period Summary" from
 * docs/PAYROLL-DATA-REQUIREMENTS.md's phasing section: one row per active
 * employee for the selected cycle (hours worked, overtime, absences,
 * holiday/weekend work, paid/unpaid leave, and every unresolved
 * reconciliation flag), previewed on-screen and downloadable as CSV for
 * handoff to payroll. Read-only -- no CRUD, unlike the Settings tab.
 *
 * Plain local filter state (not useDashboardQuery/usePaginatedQuery's
 * URL-param-backed state) -- this page's own usePayrollPeriodSummary hook
 * does the actual fetching, and there's no pagination to coordinate
 * (get_payroll_period_summary_rpc.sql already returns every active employee
 * for the period in one shot, same "headcount-bounded" precedent as the
 * Attendance List's Day mode).
 */
export default function PayrollExport() {
  // One-time seed from the URL (e.g. the weekly HR digest notification's
  // link_to) -- not a full usePaginatedQuery-style bidirectional sync, this
  // page keeps its existing plain local-state behavior otherwise. Just
  // means "arrive via a link with a period in the URL, land pre-selected."
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState(() => {
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    return startDate && endDate ? { startDate, endDate } : {};
  });
  const [selectedRow, setSelectedRow] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { employees, departments } = useAttendanceActivitiesMetadata();
  const filterConfig = getPayrollExportFilterConfig({ departments, employees });

  const { rows, isLoading, isFetching, error, hasPeriod } =
    usePayrollPeriodSummary(filters);

  // Client-side-only post-filter -- the RPC has no matching parameter (see
  // filterConfig.js), and doesn't need one: it already returns every active
  // employee's counts for the period in one shot.
  const displayRows = filters.needsReconciliation
    ? rows.filter(rowNeedsReconciliation)
    : rows;

  const columns = payrollPeriodSummaryTableConfig();
  const hasData = displayRows.length > 0;

  // Mirrors the already-filtered/displayed rows instead of re-querying
  // fetchPayrollPeriodSummary (which has no needsReconciliation param and
  // would silently export everyone) -- this page is headcount-bounded with
  // no pagination, so displayRows already IS the complete export dataset.
  const exportFetchFn = () => Promise.resolve({ data: displayRows });

  function handleOpenSidebar(row) {
    setSelectedRow(row);
    setSidebarOpen(true);
  }

  function handleCloseSidebar() {
    setSidebarOpen(false);
    setSelectedRow(null);
  }

  return (
    <>
      {/* PERIOD + DEPARTMENT/EMPLOYEE + EXPORT -- same stacking as Attendance
          Overview (SearchFilterBar's plain date range, PayrollCycleFilterBar's
          26th-25th cycle presets underneath, both writing filters.startDate/
          endDate) plus the Export dropdown reused as-is from Sales Leads. */}
      <SearchFilterBar
        filters={filters}
        onFilterChange={setFilters}
        filterConfig={filterConfig}
        enableDateRange
        disableSearch
        isLoading={isLoading}
        isError={Boolean(error)}
        enableExport
        exportFetchFn={exportFetchFn}
        exportColumns={payrollPeriodSummaryExportColumns}
        exportFileNamePrefix="Payroll_Period_Summary"
      />

      <PayrollCycleFilterBar filters={filters} onFilterChange={setFilters} />

      <div className="cardWrapperScroll">
        {!hasPeriod ? (
          <NoResult title="Select a payroll cycle (or a custom date range) to generate the summary." />
        ) : isLoading || isFetching ? (
          <CardLayout style="cardLayoutFlexFull">
            <LoadingIcon />
          </CardLayout>
        ) : !hasData || error ? (
          <NoResult title="No active employees found for this period/filter combination." />
        ) : (
          <DataTable
            data={displayRows}
            columns={columns}
            rowKey="employeeUuid"
            onRowClick={handleOpenSidebar}
          />
        )}
      </div>

      {/* RECONCILIATION SIDEBAR -- read-only drilldown for one employee's
          row (isEditing={false} so DataSidebar skips its own <DataForm>
          and just renders PayrollReconciliationSidebar as children). */}
      <AnimatePresence>
        {sidebarOpen && (
          <DataSidebar
            title={`Reconciliation — ${selectedRow?.fullName || ""}`}
            icon={MagnifyingGlassIcon}
            open={sidebarOpen}
            onClose={handleCloseSidebar}
            isEditing={false}
          >
            <PayrollReconciliationSidebar
              employeeUuid={selectedRow?.employeeUuid}
              employeeName={selectedRow?.fullName}
              resolvedEmail={selectedRow?.resolvedEmail}
              emailSource={selectedRow?.emailSource}
              startDate={filters.startDate}
              endDate={filters.endDate}
            />
          </DataSidebar>
        )}
      </AnimatePresence>
    </>
  );
}
