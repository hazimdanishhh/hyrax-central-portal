// pages/user/hr/attendanceManagement/payrollExport/PayrollExport.jsx
import { useCallback, useMemo } from "react";
import OverviewCards from "@/components/crud/overviewCards/OverviewCards";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { MagnifyingGlassIcon, WarningCircleIcon } from "@phosphor-icons/react";
import CardLayout from "@/components/cardLayout/CardLayout";
import Button from "@/components/buttons/button/Button";
import LoadingIcon from "@/components/loadingIcon/LoadingIcon";
import NoResult from "@/components/crud/noResult/NoResult";
import SearchFilterBar from "@/components/searchFilterBar/SearchFilterBar";
import PayrollCycleFilterBar from "@/components/payrollCycleFilterBar/PayrollCycleFilterBar";
import DataTable from "@/components/dataTable/DataTable";
import DataSidebar from "@/components/dataSidebar/DataSidebar";
import PayrollReconciliationSidebar from "@/components/attendance/payrollReconciliationSidebar/PayrollReconciliationSidebar";
import { useAttendanceActivitiesMetadata } from "@/features/hr/attendance/private/hooks/useAttendanceActivitiesMetadata";
import usePayrollPeriodSummary from "@/features/hr/payroll/private/hooks/usePayrollPeriodSummary";
import { usePayrollPeriodSummaryRowById } from "@/features/hr/payroll/private/hooks/usePayrollPeriodSummaryRowById";
import {
  getPayrollExportFilterConfig,
  rowNeedsReconciliation,
  getRowReconciliationFlags,
  getReconciliationCategoryPredicate,
} from "./filterConfig";
import { payrollPeriodSummaryTableConfig } from "./tableConfig";
import { payrollPeriodSummaryExportColumns } from "./exportConfig";
import {
  computePayrollReconciliationOverview,
  getPayrollExportOverviewConfig,
} from "./overviewConfig";
import "./PayrollExport.scss";

/**
 * Payroll Export tab -- the "Payroll Period Summary" from
 * docs/PAYROLL-DATA-REQUIREMENTS.md's phasing section: one row per active
 * employee for the selected cycle (hours worked, overtime, absences,
 * holiday/weekend work, paid/unpaid leave, and every unresolved
 * reconciliation flag), previewed on-screen and downloadable as CSV for
 * handoff to payroll. Read-only -- no CRUD, unlike the Holidays tab.
 *
 * Filters are fully URL-synced (added 2026-09-15) -- department/employee/
 * needsReconciliation/startDate/endDate all read from and write back to the
 * querystring, so a filtered view can be bookmarked/shared/reopened exactly
 * as left (e.g. the weekly HR digest notification's link_to already relied
 * on startDate/endDate surviving a reload; every other filter now does too).
 * Deliberately a small inline sync, not usePaginatedQuery/useDashboardQuery
 * -- this page has no pagination/sorting to coordinate
 * (get_payroll_period_summary_rpc.sql already returns every active employee
 * for the period in one shot, same "headcount-bounded" precedent as the
 * Attendance List's Day mode), and useDashboardQuery's own filters
 * always writes a stray, unused `page=1` alongside them.
 */
export default function PayrollExport() {
  const navigate = useNavigate();
  const { employeeUuid } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(() => {
    const obj = {};
    searchParams.forEach((value, key) => {
      obj[key] = value;
    });
    return obj;
  }, [searchParams.toString()]);

  // Matches SearchFilterBar/PayrollCycleFilterBar's existing calling
  // convention exactly -- both always call onFilterChange with a full
  // merged {...filters, changedKey: value} object (empty string to clear),
  // so this only ever needs to apply that object to the URL, never diff
  // against what's already there.
  const setFilters = useCallback(
    (newFilters) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          Object.entries(newFilters).forEach(([key, value]) => {
            if (value === undefined || value === null || value === "") {
              params.delete(key);
            } else {
              params.set(key, String(value));
            }
          });
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const { employees, departments, workLocations } =
    useAttendanceActivitiesMetadata();
  const filterConfig = getPayrollExportFilterConfig({
    departments,
    employees,
    workLocations,
  });

  const { rows, isLoading, isFetching, error, hasPeriod } =
    usePayrollPeriodSummary(filters);

  // Client-side-only post-filter -- the RPC has no matching parameter (see
  // filterConfig.js), and doesn't need one: it already returns every active
  // employee's counts for the period in one shot. getReconciliationCategoryPredicate
  // resolves "true" back to the original any-category rowNeedsReconciliation
  // check, and every other value to its own specific predicate (see that
  // function's own comment) -- so a filter value coming from either the
  // dropdown or an Overview Cards tile click is handled identically here.
  const displayRows = filters.needsReconciliation
    ? rows.filter(
        getReconciliationCategoryPredicate(filters.needsReconciliation),
      )
    : rows;

  // Overview Cards -- one tile per reconciliation category (see
  // overviewConfig.js for the segmenting/coloring rationale), always computed
  // over the full `rows`, never `displayRows`, so the tiles keep showing the
  // period's true totals regardless of which category filter (if any) is
  // currently narrowing the table below them.
  const reconciliationOverview = useMemo(
    () => computePayrollReconciliationOverview(rows),
    [rows],
  );
  const overviewItems = getPayrollExportOverviewConfig(
    reconciliationOverview,
    filters,
  );

  // Non-blocking "review before exporting" signal -- checked against the
  // FULL `rows`, not `displayRows`, so this stays accurate regardless of
  // whether the "Needs Reconciliation" filter happens to be applied right
  // now. Two independent things worth flagging: unresolved absence/half-day/
  // leave-conflict/leave-error items (same rule the filter/badge already
  // use), and hours still sitting on unapproved app activities (excluded
  // from hoursWorkedTotal/overtimeHoursTotal/etc. already -- see
  // tableConfig.jsx's own comment -- but worth surfacing here too so it
  // isn't only visible by noticing a smaller-than-expected total).
  const pendingReconciliationCount = rows.filter(rowNeedsReconciliation).length;
  const pendingApprovalHours = rows.reduce(
    (sum, row) => sum + Number(row.pendingApprovalHoursTotal || 0),
    0,
  );
  const showReconciliationWarning =
    hasPeriod &&
    !isLoading &&
    !isFetching &&
    (pendingReconciliationCount > 0 || pendingApprovalHours > 0);

  const columns = payrollPeriodSummaryTableConfig();
  const hasData = displayRows.length > 0;

  // Mirrors the already-filtered/displayed rows instead of re-querying
  // fetchPayrollPeriodSummary (which has no needsReconciliation param and
  // would silently export everyone) -- this page is headcount-bounded with
  // no pagination, so displayRows already IS the complete export dataset.
  const exportFetchFn = () => Promise.resolve({ data: displayRows });

  // SIDEBAR OPEN & CLOSE -- URL-driven (:employeeUuid), same pattern as
  // EmployeeManagement.jsx, with a period-scoped fallback fetch (see
  // usePayrollPeriodSummaryRowById) for a deep link whose employee got
  // filtered out by the current department/employee filter.
  const { data: fetchedRow } = usePayrollPeriodSummaryRowById(
    employeeUuid,
    filters,
  );

  const selectedRow = useMemo(() => {
    if (!employeeUuid) return null;

    const rowInList = displayRows?.find((r) => r.employeeUuid === employeeUuid);
    if (rowInList) return rowInList;

    return fetchedRow || null;
  }, [employeeUuid, displayRows, fetchedRow]);

  const sidebarOpen = !!selectedRow;

  function handleOpenSidebar(row) {
    navigate(`${row.employeeUuid}?${searchParams.toString()}`);
  }

  function handleCloseSidebar() {
    navigate(`/app/hr/attendance/payroll-export?${searchParams.toString()}`);
  }

  return (
    <>
      {/* One tile per reconciliation category -- see overviewConfig.js for
          the segmenting/coloring rationale and why each tile's filter must
          spread the page's own currently-active filters. Gated on hasPeriod
          (not just "rows.length > 0") so an all-zero/all-green row never
          renders before a period is even selected -- that would read as "all
          clear" when nothing has actually been checked yet. */}
      <OverviewCards items={overviewItems} />

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

      {/* Non-blocking -- HR stays in control and can still export
          deliberately, this is a heads-up, not a gate. */}
      {/* {showReconciliationWarning && (
        <CardLayout style="generalCard redCard">
          <WarningCircleIcon size={16} />
          <p className="textRegular textXS">
            {pendingReconciliationCount > 0 &&
              `${pendingReconciliationCount} employee${pendingReconciliationCount === 1 ? " has" : "s have"} unresolved reconciliation items`}
            {pendingReconciliationCount > 0 &&
              pendingApprovalHours > 0 &&
              ", and "}
            {pendingApprovalHours > 0 &&
              `${pendingApprovalHours.toFixed(2)} hours are still awaiting approval`}
            {" — review before finalizing payroll."}
          </p>
          <Button
            name="Show only flagged"
            style="button buttonType4 rejection textXXS"
            onClick={() => setFilters({ needsReconciliation: "true" })}
          />
        </CardLayout>
      )} */}

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
            getRowFlags={getRowReconciliationFlags}
            flagTooltipTitle="Needs Reconciliation"
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
              row={selectedRow}
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
