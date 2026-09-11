// pages/user/hr/attendanceManagement/payrollExport/PayrollExport.jsx
import { useState } from "react";
import CardLayout from "@/components/cardLayout/CardLayout";
import LoadingIcon from "@/components/loadingIcon/LoadingIcon";
import NoResult from "@/components/crud/noResult/NoResult";
import SearchFilterBar from "@/components/searchFilterBar/SearchFilterBar";
import PayrollCycleFilterBar from "@/components/payrollCycleFilterBar/PayrollCycleFilterBar";
import DataTable from "@/components/dataTable/DataTable";
import { useAttendanceActivitiesMetadata } from "@/features/hr/attendance/private/hooks/useAttendanceActivitiesMetadata";
import usePayrollPeriodSummary from "@/features/hr/payroll/private/hooks/usePayrollPeriodSummary";
import { fetchPayrollPeriodSummary } from "@/features/hr/payroll/private/api/payrollPeriodSummaryService";
import { getPayrollExportFilterConfig } from "./filterConfig";
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
  const [filters, setFilters] = useState({});

  const { employees, departments } = useAttendanceActivitiesMetadata();
  const filterConfig = getPayrollExportFilterConfig({ departments, employees });

  const { rows, isLoading, isFetching, error, hasPeriod } =
    usePayrollPeriodSummary(filters);

  const columns = payrollPeriodSummaryTableConfig();
  const hasData = rows.length > 0;

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
        exportFetchFn={fetchPayrollPeriodSummary}
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
          <DataTable data={rows} columns={columns} rowKey="employeeUuid" />
        )}
      </div>
    </>
  );
}
