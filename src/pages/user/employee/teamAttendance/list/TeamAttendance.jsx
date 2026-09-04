// pages/user/employee/teamAttendance/list/TeamAttendance.jsx
import {
  CaretLeftIcon,
  CaretRightIcon,
  PencilSimpleLineIcon,
} from "@phosphor-icons/react";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import AttendanceCard from "@/components/attendance/attendanceCard/AttendanceCard";
import AttendanceSidebarHR from "@/components/attendance/attendanceSidebarHR/AttendanceSidebarHR";
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
import ActionModal from "@/components/modals/actionModal/ActionModal";
import SearchFilterBar from "@/components/searchFilterBar/SearchFilterBar";
import { useMessage } from "@/context/MessageContext";
import { useEmployee } from "@/context/EmployeeContext";
import { supabase } from "@/lib/supabaseClient";
import useSubordinatesPublic from "@/features/hr/employees/public/hooks/useSubordinatesPublic";
import { useAttendanceActivitiesMetadata } from "@/features/hr/attendance/private/hooks/useAttendanceActivitiesMetadata";
import { attendanceDailySummaryTableConfig } from "@/pages/user/hr/attendanceManagement/list/tableConfig";
import { getAttendanceActivitiesSortConfig } from "@/pages/user/hr/attendanceManagement/list/sortConfig";
import { getAttendanceActivitiesLayoutConfig } from "@/pages/user/hr/attendanceManagement/list/layoutConfig";
import useTeamAttendanceDailyList from "@/features/employee/attendance/private/hooks/useTeamAttendanceDailyList";
import useTeamAttendanceSearch from "@/features/employee/attendance/private/hooks/useTeamAttendanceSearch";
import { getTeamAttendanceFilterConfig } from "./filterConfig";

// Mirrors HR's SEARCH_MODE_FILTER_KEYS, minus "department"/"manager" (this
// page's scope is always "my direct reports", so those keys never appear in
// this page's own filter config).
const SEARCH_MODE_FILTER_KEYS = [
  "employee",
  "hrFlag",
  "startDate",
  "endDate",
  "workingDayOnly",
  "presentOnly",
  "overtimeOnly",
  "lateArrival",
  "earlyLeave",
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
 * Team Attendance -- a manager's view of their direct reports' attendance.
 * View + approve/reject only: no create/edit form, no clock-out action
 * (that's the employee's own or HR's job, not the manager's).
 */
export default function TeamAttendance() {
  const queryClient = useQueryClient();
  const { showMessage } = useMessage();
  const { employee } = useEmployee();
  const [layout, setLayout] = useState(1); // 1: Card, 2: Table
  const [selectedRow, setSelectedRow] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState(null); // "approve" | "reject"
  const [actionLoading, setActionLoading] = useState(false);

  // ==============
  // HOOKS
  // ==============
  const [searchParams] = useSearchParams();
  const isSearchMode =
    SEARCH_MODE_FILTER_KEYS.some((key) => searchParams.get(key)) ||
    Boolean(searchParams.get("search"));

  const dayModeResult = useTeamAttendanceDailyList({
    managerId: employee?.id,
    defaultSortBy: "full_name",
    defaultSortOrder: "ascending",
    enabled: !isSearchMode,
  });

  const searchModeResult = useTeamAttendanceSearch({
    managerId: employee?.id,
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
  // METADATA -- direct reports only, never the company-wide roster
  // ==============
  const { data: subordinates = [], isLoading: subordinatesLoading } =
    useSubordinatesPublic(employee?.id);
  // Only workLocations is needed from this hook here -- reused rather than
  // adding a second, narrower fetch just for one filter dropdown, same
  // technique this app's other Overview/List pages already use.
  const { workLocations } = useAttendanceActivitiesMetadata();

  // ==============
  // CONFIG
  // ==============
  const layoutOptions = getAttendanceActivitiesLayoutConfig();
  const sortOptions = getAttendanceActivitiesSortConfig();
  const columns = attendanceDailySummaryTableConfig();
  const filterConfig = getTeamAttendanceFilterConfig({
    subordinates,
    workLocations,
  });

  // ==============
  // DATA LOADING
  // ==============
  const isLoading = attendanceActivitiesLoading || subordinatesLoading;
  const hasData = activities.length > 0;

  // ==============
  // SIDEBAR OPEN & CLOSE
  // ==============
  function handleOpenSidebar(data) {
    setSelectedRow(data);
    setSidebarOpen(true);
  }

  function handleCloseSidebar() {
    setSidebarOpen(false);
    setSelectedRow(null);
  }

  function closeActionModal() {
    setModalOpen(false);
    setSelectedId(null);
    setModalType(null);
  }

  // ==============
  // APPROVE / REJECT -- same RPCs HR's page calls, now hardened server-side
  // to also authorize the target employee's direct manager (see
  // supabase/functions/approve_attendance.sql / reject_attendance.sql)
  // ==============
  const handleApprove = async (id) => {
    try {
      setActionLoading(true);
      const { error } = await supabase.rpc("approve_attendance", {
        activity_id: id,
      });
      if (error) throw error;
      showMessage("Attendance approved successfully", "success");
    } catch (err) {
      console.error("Approve error:", err.message);
      showMessage("Error approving attendance", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (id, reason) => {
    try {
      setActionLoading(true);
      const { error } = await supabase.rpc("reject_attendance", {
        activity_id: id,
        reason,
      });
      if (error) throw error;
      showMessage("Attendance rejected successfully", "success");
    } catch (err) {
      console.error("Reject error:", err.message);
      showMessage("Error rejecting attendance", "error");
    } finally {
      setActionLoading(false);
    }
  };

  async function handleConfirmAction(formValues) {
    if (modalType === "approve") await handleApprove(selectedId);
    if (modalType === "reject")
      await handleReject(selectedId, formValues?.reason);

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["team_attendance_daily"] }),
      queryClient.invalidateQueries({ queryKey: ["team_attendance_search"] }),
      queryClient.invalidateQueries({ queryKey: ["attendance_activities"] }),
    ]);

    closeActionModal();
  }

  return (
    <>
      <SearchFilterBar
        search={search}
        onSearchChange={setSearch}
        filters={filters}
        onFilterChange={setFilters}
        filterConfig={filterConfig}
        placeholder="Search team attendance..."
        enableDateRange
      />

      {/* <PageHeader>
        <PageActions
          layout={layout}
          setLayout={setLayout}
          options={layoutOptions}
        />

        <SortBar
          sortBy={sortBy}
          setSortBy={setSortBy}
          sortOptions={sortOptions}
          sortOrder={sortOrder}
          setSortOrder={setSortOrder}
        />
      </PageHeader> */}

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

      {!isSearchMode && (
        <CardLayout style="pageResultContainer">
          {error ? (
            <p className="textRegular textXXS">Error loading results</p>
          ) : (
            <p className="textRegular textXXS">
              <strong>{totalCount}</strong> employee
              {totalCount === 1 ? "" : "s"} &mdash; {formatDayLabel(date)}
            </p>
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
          />
        ) : (
          <CardLayout style="cardLayout1 cardPaddingSmall cardGapSmall">
            {activities.map((activity) => (
              <AttendanceCard
                key={activity.id}
                activity={activity}
                onClick={() => handleOpenSidebar(activity)}
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
              mode="manager"
              setSelectedId={setSelectedId}
              setModalType={setModalType}
              setModalOpen={setModalOpen}
            />
          </DataSidebar>
        )}
      </AnimatePresence>

      <ActionModal
        open={modalOpen}
        onClose={closeActionModal}
        title={
          modalType === "approve" ? "Approve Attendance" : "Reject Attendance"
        }
        description={
          modalType === "approve"
            ? "Are you sure you want to approve this attendance?"
            : "Are you sure you want to reject this attendance?"
        }
        confirmText={modalType === "approve" ? "Approve" : "Reject"}
        loading={actionLoading}
        fields={
          modalType === "reject"
            ? [
                {
                  name: "reason",
                  label: "Rejection Reason",
                  type: "text",
                  required: true,
                },
              ]
            : []
        }
        onConfirm={handleConfirmAction}
        modalType={modalType}
      />
    </>
  );
}
