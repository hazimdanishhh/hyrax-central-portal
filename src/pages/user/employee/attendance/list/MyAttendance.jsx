// pages/user/employee/attendance/list/MyAttendance.jsx
import {
  CalendarPlusIcon,
  CaretLeftIcon,
  CaretRightIcon,
  PencilSimpleLineIcon,
} from "@phosphor-icons/react";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence } from "framer-motion";
import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import AttendanceCard from "@/components/attendance/attendanceCard/AttendanceCard";
import AttendanceSidebarHR from "@/components/attendance/attendanceSidebarHR/AttendanceSidebarHR";
import AttendanceBackfillWizard from "@/components/attendance/attendanceBackfillWizard/AttendanceBackfillWizard";
import Button from "@/components/buttons/button/Button";
import CardLayout from "@/components/cardLayout/CardLayout";
import ActiveFiltersBar from "@/components/crud/activeFiltersBar/ActiveFiltersBar";
import NoResult from "@/components/crud/noResult/NoResult";
import PageHeader from "@/components/crud/pageHeader/PageHeader";
import PageActions from "@/components/crud/pageActions/PageActions";
import PageResult from "@/components/crud/pageResult/PageResult";
import SortBar from "@/components/crud/sortBar/SortBar";
import DataSidebar from "@/components/dataSidebar/DataSidebar";
import DataTable from "@/components/dataTable/DataTable";
import LoadingIcon from "@/components/loadingIcon/LoadingIcon";
import StatusTab from "@/components/crud/statusTab/StatusTab";
import { useEmployee } from "@/context/EmployeeContext";
import useAttendanceActivityMutations from "@/features/hr/attendance/private/hooks/useAttendanceActivityMutations";
import { attendanceDailySummaryTableConfig } from "@/pages/user/hr/attendanceManagement/list/tableConfig";
import { getAttendanceActivitiesSortConfig } from "@/pages/user/hr/attendanceManagement/list/sortConfig";
import { getAttendanceActivitiesLayoutConfig } from "@/pages/user/hr/attendanceManagement/list/layoutConfig";
import useMyAttendanceDailyList from "@/features/employee/attendance/private/hooks/useMyAttendanceDailyList";
import { useAttendanceActivityById } from "@/features/hr/attendance/private/hooks/useAttendanceActivityById";
import { useAttendanceActivitiesMetadata } from "@/features/hr/attendance/private/hooks/useAttendanceActivitiesMetadata";
import useMyAttendanceSearch from "@/features/employee/attendance/private/hooks/useMyAttendanceSearch";
import { getMyAttendanceFilterConfig } from "./filterConfig";
import SearchFilterBar from "@/components/searchFilterBar/SearchFilterBar";
import { buildStatusTabs } from "@/functions/statusTabs";
import { getAttendanceStatusTabsConfig } from "@/functions/attendanceStatusTabsConfig";
import { getAttendanceReconciliationFlags } from "@/functions/attendanceReconciliationFlags";

// Which filter keys promote the page from Day mode (one calendar day) into
// Search mode (all dates unless narrowed, row-paginated) -- mirrors HR's own
// list, minus employee/department/manager (this page's scope is always
// "me", so those keys never appear in this page's own filter config).
const SEARCH_MODE_FILTER_KEYS = [
  "hrFlag",
  "startDate",
  "endDate",
  "dayType",
  "presentOnly",
  "onLeave",
  "overtimeOnly",
  "lateArrival",
  "earlyLeave",
  "leaveAttendanceConflict",
  "insufficientHalfDayHours",
  "leaveFractionError",
  "publicHoliday",
  "workedOnHoliday",
  "workedOnWeekend",
];

const WEEKDAY_DATE_FORMATTER = new Intl.DateTimeFormat("en-MY", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

function formatDayLabel(dateString) {
  if (!dateString) return "";
  const [year, month, day] = dateString.split("-").map(Number);
  return WEEKDAY_DATE_FORMATTER.format(new Date(year, month - 1, day));
}

/**
 * My Attendance -- an individual employee's own attendance history.
 * View + self clock-out only: no create/edit form, no approve/reject.
 */
export default function MyAttendance() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { attendanceId } = useParams();
  const { employee } = useEmployee();
  const [layout, setLayout] = useState(1); // 1: Card, 2: Table
  const [backfillOpen, setBackfillOpen] = useState(false);
  const { attendanceTypes } = useAttendanceActivitiesMetadata();

  // ==============
  // HOOKS
  // ==============
  const [searchParams] = useSearchParams();
  const isSearchMode =
    SEARCH_MODE_FILTER_KEYS.some((key) => searchParams.get(key)) ||
    Boolean(searchParams.get("search"));

  const dayModeResult = useMyAttendanceDailyList({
    employeeId: employee?.id,
    defaultSortBy: "full_name",
    defaultSortOrder: "ascending",
    enabled: !isSearchMode,
  });

  const searchModeResult = useMyAttendanceSearch({
    employeeId: employee?.id,
    defaultSortBy: "work_date",
    defaultSortOrder: "descending",
    enabled: isSearchMode,
  });

  const active = isSearchMode ? searchModeResult : dayModeResult;

  const {
    data: activities,
    totalCount,
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
    resetParams,
    isLoading: attendanceActivitiesLoading,
    isFetching,
    error,
  } = active;

  const { date, setDate, goToPreviousDay, goToNextDay, goToToday } =
    dayModeResult;
  const { page, totalPages, setPage } = searchModeResult;

  // ==============
  // MUTATIONS -- only clock-out is needed here
  // ==============
  const { clockOutAttendanceActivity } = useAttendanceActivityMutations();

  // ==============
  // CONFIG
  // ==============
  const layoutOptions = getAttendanceActivitiesLayoutConfig();
  const sortOptions = getAttendanceActivitiesSortConfig();
  const columns = attendanceDailySummaryTableConfig();
  const filterConfig = getMyAttendanceFilterConfig();

  // Same tab config HR's Attendance List uses (attendanceStatusTabsConfig.js)
  // -- every param key it targets is already in this page's own
  // SEARCH_MODE_FILTER_KEYS above.
  const statusTabs = buildStatusTabs({
    searchParams,
    ...getAttendanceStatusTabsConfig(),
  });

  // ==============
  // DATA LOADING
  // ==============
  const isLoading = attendanceActivitiesLoading;
  const hasData = activities.length > 0;

  // ==============
  // SIDEBAR OPEN & CLOSE -- URL-driven (:attendanceId), same pattern as
  // AttendanceManagement.jsx (HR). Reuses HR's fallback-fetch hook directly
  // -- this page's "employee" filter is only a client-side convenience
  // (per myAttendanceService.js's own comment), RLS already scopes every
  // unified_daily_attendance row to the caller's own, so there's no
  // additional security concern to a bare useAttendanceActivityById call.
  // ==============
  const { data: fetchedActivity } = useAttendanceActivityById(attendanceId);

  const selectedRow = useMemo(() => {
    if (!attendanceId) return null;

    const activityInList = activities?.find((a) => a.id === attendanceId);
    if (activityInList) return activityInList;

    return fetchedActivity || null;
  }, [attendanceId, activities, fetchedActivity]);

  const sidebarOpen = !!selectedRow;

  function handleOpenSidebar(data) {
    navigate(`${data.id}?${searchParams.toString()}`);
  }

  function handleCloseSidebar() {
    navigate(`/app/employee/attendance/list?${searchParams.toString()}`);
  }

  // ==============
  // CLOCKING OUT
  // ==============
  const handleClockOut = async (id) => {
    await clockOutAttendanceActivity(id);

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["my_attendance_daily"] }),
      queryClient.invalidateQueries({ queryKey: ["my_attendance_search"] }),
      queryClient.invalidateQueries({ queryKey: ["attendance_activities"] }),
    ]);

    handleCloseSidebar();
  };

  return (
    <>
      <SearchFilterBar
        search={search}
        onSearchChange={setSearch}
        filters={filters}
        onFilterChange={setFilters}
        filterConfig={filterConfig}
        placeholder="Search my attendance..."
        enableDateRange
      />

      {/* The layout toggle and SortBar remain commented out (the Table layout
          is unreachable on this page), but the header itself is now needed for
          the self-reconciliation action -- this is the surface the Payroll
          Export reconciliation email actually sends the employee to. */}
      <PageHeader>
        <PageActions
          actionButtons={[
            {
              // "Add", not "Fix": this is for declaring whole days that
              // have no clock in/out to begin with -- business trips, company
              // events, training. Correcting a day that went wrong is the day
              // sidebar's job, reached by opening that day.
              name: "Add Attendance",
              icon: CalendarPlusIcon,
              onClick: () => setBackfillOpen(true),
              style: "button buttonType5 greenFill buttonFull textXXS",
            },
          ]}
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

      <div className="statusTabsRow scrollbar">
        {statusTabs.map((tab) => (
          <StatusTab
            key={tab.label}
            to={tab.to}
            label={tab.label}
            themeType={tab.themeType}
            isActive={tab.isActive}
          />
        ))}
      </div>

      {!isSearchMode && (
        <CardLayout style="pageResultContainer">
          {error ? (
            <p className="textRegular textXXS">Error loading results</p>
          ) : (
            <p className="textRegular textXXS">{formatDayLabel(date)}</p>
          )}

          <CardLayout style="pageNumberContainer">
            <Button
              size={20}
              icon={CaretLeftIcon}
              style="iconButton2 textXXS"
              title="Previous Day"
              onClick={goToPreviousDay}
            />

            <input
              type="date"
              value={date}
              max={new Date().toLocaleDateString("en-CA")}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="pageInput"
            />

            <Button
              size={20}
              icon={CaretRightIcon}
              style="iconButton2 textXXS"
              title="Next Day"
              onClick={goToNextDay}
            />

            <Button
              name="Today"
              style="button buttonType4 textXXS"
              onClick={goToToday}
            />
          </CardLayout>
        </CardLayout>
      )}

      {isSearchMode && (
        <PageResult
          data={activities}
          totalCount={totalCount}
          page={page}
          setPage={setPage}
          totalPages={totalPages}
          error={error}
        />
      )}

      <div className="cardWrapperScroll">
        {isLoading || isFetching ? (
          <CardLayout style="cardLayoutFlexFull">
            <LoadingIcon />
          </CardLayout>
        ) : !hasData ? (
          <NoResult
            title={
              isSearchMode
                ? "No attendance records match these filters."
                : "No attendance data for this date."
            }
          />
        ) : layout === 2 ? (
          <DataTable
            data={activities}
            columns={columns}
            rowKey="id"
            onRowClick={handleOpenSidebar}
            getRowFlags={getAttendanceReconciliationFlags}
            flagTooltipTitle="Needs Reconciliation"
          />
        ) : (
          <CardLayout style="cardLayout1 cardPaddingSmall cardGapSmall">
            {activities.map((activity) => (
              <AttendanceCard
                key={activity.id}
                activity={activity}
                to={`${activity.id}?${searchParams.toString()}`}
              />
            ))}
          </CardLayout>
        )}
      </div>

      <AnimatePresence>
        {sidebarOpen && (
          <DataSidebar
            title="Attendance Detail"
            icon={PencilSimpleLineIcon}
            open={sidebarOpen}
            onClose={handleCloseSidebar}
            isEditing={false}
          >
            <AttendanceSidebarHR
              selectedRow={selectedRow}
              mode="self"
              clockOutAttendanceActivity={handleClockOut}
              setSelectedId={() => {}}
              setModalType={() => {}}
              setModalOpen={() => {}}
            />
          </DataSidebar>
        )}
      </AnimatePresence>

      {/* Self-service reconciliation -- scope "self" locks the record to the
          signed-in employee and skips the employee-picker step entirely.
          create_attendance_backfill lands these rows as 'Pending', never
          Approved: an employee asserting time nobody observed is exactly what
          the existing manager/HR approval step is for. */}
      <AttendanceBackfillWizard
        open={backfillOpen}
        onClose={() => setBackfillOpen(false)}
        scope="self"
        currentEmployeeId={employee?.id}
        attendanceTypes={attendanceTypes}
      />
    </>
  );
}
