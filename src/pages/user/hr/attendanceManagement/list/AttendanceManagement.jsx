// pages/user/hr/attendanceManagement/list/AttendanceManagement.jsx
import {
  CalendarPlusIcon,
  CaretLeftIcon,
  CaretRightIcon,
  PencilSimpleLineIcon,
  PlusCircleIcon,
} from "@phosphor-icons/react";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence } from "framer-motion";
import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import AttendanceCard from "../../../../../components/attendance/attendanceCard/AttendanceCard";
import AttendanceSidebarHR from "../../../../../components/attendance/attendanceSidebarHR/AttendanceSidebarHR";
import AttendanceBackfillWizard from "../../../../../components/attendance/attendanceBackfillWizard/AttendanceBackfillWizard";
import Button from "../../../../../components/buttons/button/Button";
import CardLayout from "../../../../../components/cardLayout/CardLayout";
import ActiveFiltersBar from "../../../../../components/crud/activeFiltersBar/ActiveFiltersBar";
import NoResult from "../../../../../components/crud/noResult/NoResult";
import PageHeader from "../../../../../components/crud/pageHeader/PageHeader";
import PageActions from "../../../../../components/crud/pageActions/PageActions";
import PageResult from "../../../../../components/crud/pageResult/PageResult";
import SortBar from "../../../../../components/crud/sortBar/SortBar";
import StatusTab from "../../../../../components/crud/statusTab/StatusTab";
import DataSidebar from "../../../../../components/dataSidebar/DataSidebar";
import DataTable from "../../../../../components/dataTable/DataTable";
import LoadingIcon from "../../../../../components/loadingIcon/LoadingIcon";
import ActionModal from "../../../../../components/modals/actionModal/ActionModal";
import SearchFilterBar from "../../../../../components/searchFilterBar/SearchFilterBar";
import { useMessage } from "../../../../../context/MessageContext";
import { useEmployee } from "../../../../../context/EmployeeContext";
import { useAttendanceActivitiesMetadata } from "../../../../../features/hr/attendance/private/hooks/useAttendanceActivitiesMetadata";
import useAttendanceActivityMutations from "../../../../../features/hr/attendance/private/hooks/useAttendanceActivityMutations";
import useAttendanceDailyList from "../../../../../features/hr/attendance/private/hooks/useAttendanceDailyList";
import { useAttendanceActivityById } from "../../../../../features/hr/attendance/private/hooks/useAttendanceActivityById";
import useAttendanceAdjustmentReasons from "../../../../../features/hr/attendance/private/hooks/useAttendanceAdjustmentReasons";
import usePaginatedQuery from "../../../../../hooks/usePaginatedQuery";
import useCrudActionState from "../../../../../hooks/useCrudActionState";
import { supabase } from "../../../../../lib/supabaseClient";
import { uploadAttendancePhoto } from "../../../../../services/storage/uploadAttendancePhoto";
import { buildStatusTabs } from "../../../../../functions/statusTabs";
import { getAttendanceStatusTabsConfig } from "../../../../../functions/attendanceStatusTabsConfig";
import "./AttendanceManagement.scss";
import { createAttendanceActivityFormConfig } from "./createAttendanceActivityFormConfig";
import { getAttendanceActivitiesFilterConfig } from "./filterConfig";
import { getAttendanceActivitiesLayoutConfig } from "./layoutConfig";
import { getAttendanceActivitiesSortConfig } from "./sortConfig";
import { attendanceDailySummaryTableConfig } from "./tableConfig";
import {
  fetchUnifiedAttendance,
  fetchUnifiedAttendanceSearch,
} from "../../../../../features/hr/attendance/private/api/attendanceOverviewService";

// Which filter keys promote the page from Day mode (one calendar day) into
// Search mode (all dates unless narrowed, row-paginated) -- see
// useAttendanceDailyList/fetchUnifiedAttendanceSearch's own header comments
// for why these need genuinely different query/pagination strategies.
const SEARCH_MODE_FILTER_KEYS = [
  "employee",
  "department",
  "manager",
  "hrFlag",
  "startDate",
  "endDate",
  // Defensive additions -- every real drill-through link using these also
  // carries hrFlag/startDate/endDate (which already force search mode), but
  // listing them here too avoids a silent Day-mode no-op if one is ever used
  // alone via a hand-edited URL (the same class of bug the statusBucket
  // embedded-filter fix addressed on the Employee List).
  "dayType",
  "presentOnly",
  "onLeave",
  "overtimeOnly",
  "lateArrival",
  "earlyLeave",
  // Previously missing here despite already being real, working
  // filterConfig.js options with backing applyAttendanceFilter logic -- a
  // genuine bug: using any of these six alone silently stayed in Day mode
  // instead of promoting to Search mode.
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
 * HR Attendance Management Page
 * This is private HR / employment data
 * Server-side filtering and pagination
 */
export default function AttendanceManagement() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { attendanceId } = useParams();
  const [layout, setLayout] = useState(1); // 1: Card, 2: Table
  const [selectedId, setSelectedId] = useState(null);
  const [backfillOpen, setBackfillOpen] = useState(false);
  const { showMessage } = useMessage();
  const { employee } = useEmployee();
  const { adjustmentReasons } = useAttendanceAdjustmentReasons();

  const {
    modalOpen,
    setModalOpen,
    selectedRowId,
    modalType,
    setModalType,
    pendingSaveRow,
    handleRequestSave,
    handleRequestDelete,
    closeActionModal,
  } = useCrudActionState();

  // ==============
  // HOOKS
  // ==============

  // DAY MODE vs SEARCH MODE: the moment Employee/Department/Manager/Status/
  // date-range is set, or search text is typed, the page stops being "one
  // calendar day" and becomes an ordinary all-dates-unless-narrowed,
  // row-paginated filtered list -- otherwise a filter like "this one
  // employee" would only ever show their single row for whatever date
  // happened to be selected, not their actual history.
  const [searchParams] = useSearchParams();
  const isSearchMode =
    SEARCH_MODE_FILTER_KEYS.some((key) => searchParams.get(key)) ||
    Boolean(searchParams.get("search"));

  // ONE PAGE = ONE CALENDAR DAY (see useAttendanceDailyList) -- defaults to
  // today, and a day's roster is never split across pages since it's fetched
  // in one shot rather than OFFSET/LIMIT-sliced. Only active (fetches) in
  // Day mode.
  const dayModeResult = useAttendanceDailyList({
    queryKey: "attendance_daily",
    queryFn: fetchUnifiedAttendance,
    defaultSortBy: "full_name",
    defaultSortOrder: "ascending",
    enabled: !isSearchMode,
  });

  // ALL DATES, ROW-PAGINATED (see fetchUnifiedAttendanceSearch) -- only
  // active (fetches) in Search mode. Default sort is most-recent-date-first,
  // since this mode exists specifically to browse a filter's full history.
  const searchModeResult = usePaginatedQuery({
    queryKey: "attendance_search",
    queryFn: fetchUnifiedAttendanceSearch,
    pageSize: 50,
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

  // Day-mode-only / search-mode-only navigation state -- both hooks are
  // always called (rules of hooks), so these are always available; only the
  // relevant set is ever rendered, based on isSearchMode.
  const { date, setDate, goToPreviousDay, goToNextDay, goToToday } =
    dayModeResult;
  const { page, totalPages, setPage } = searchModeResult;

  // ==============
  // METADATA
  // ==============
  const {
    employees,
    departments,
    attendanceTypes,
    workLocations,
    isLoading: metadataLoading,
  } = useAttendanceActivitiesMetadata();

  // ==============
  // MUTATIONS HOOK
  // ==============
  const {
    createAttendanceActivity: createRow,
    updateAttendanceActivity: updateRow,
    deleteAttendanceActivity: deleteRow,
    clockOutAttendanceActivity,
    saving,
    deleting,
  } = useAttendanceActivityMutations();

  // ==============
  // CONFIG
  // ==============
  const layoutOptions = getAttendanceActivitiesLayoutConfig();
  const sortOptions = getAttendanceActivitiesSortConfig();
  // Table-view (read-only) display columns -- unified_daily_attendance's
  // shape. The "Add Attendance" create form uses a separate config further
  // down (createAttendanceActivityFormConfig), since creating still inserts
  // into the raw attendance_activities table, a different shape entirely.
  const columns = attendanceDailySummaryTableConfig();
  const createFormColumns = createAttendanceActivityFormConfig({
    employees,
    attendanceTypes,
    adjustmentReasons,
  });
  const filterConfig = getAttendanceActivitiesFilterConfig({
    employees,
    departments,
    workLocations,
  });
  // Config shared with MyAttendance.jsx/TeamAttendance.jsx
  // (attendanceStatusTabsConfig.js) so the 3 pages' tab rows can't drift
  // apart. Every param key used is already in SEARCH_MODE_FILTER_KEYS --
  // reuses existing, already-correct filter params, no new backend logic.
  const statusTabs = buildStatusTabs({
    searchParams,
    ...getAttendanceStatusTabsConfig(),
  });

  // ==============
  // DATA LOADING
  // ==============
  const isLoading = attendanceActivitiesLoading || metadataLoading;
  const hasData = activities.length > 0;

  // ==============
  // SIDEBAR OPEN & CLOSE -- URL-driven (:attendanceId), same pattern as
  // EmployeeManagement.jsx/LeadsManagement.jsx: check the already-loaded
  // day/page first (instant UI), else fall back to
  // useAttendanceActivityById (deep link to a row not on the current
  // day/page).
  // ==============
  const { data: fetchedActivity } = useAttendanceActivityById(attendanceId);

  const selectedRow = useMemo(() => {
    if (attendanceId === "new") return {};
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
    navigate(`/app/hr/attendance/list?${searchParams.toString()}`);
  }

  // ==============
  // CLOCKING OUT
  // ==============
  const handleClockOut = async (id) => {
    await clockOutAttendanceActivity(id);

    // Day mode's roster, Search mode's list, AND the sidebar's per-day punch
    // timeline (AttendanceSidebarHR's own useQuery, keyed
    // ["attendance_activities", employee_uuid, work_date]) all need
    // refetching -- three different query keys, only one of which is
    // actually active at a time (the other is disabled and won't refetch).
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["attendance_daily"] }),
      queryClient.invalidateQueries({ queryKey: ["attendance_search"] }),
      queryClient.invalidateQueries({ queryKey: ["attendance_activities"] }),
    ]);

    handleCloseSidebar();
  };

  // ==============
  // APPROVE
  // ==============
  const [, setActionLoadingId] = useState(null);

  const handleApprove = async (id) => {
    try {
      setActionLoadingId(id);

      const { error } = await supabase.rpc("approve_attendance", {
        activity_id: id,
      });

      if (error) throw error;

      showMessage("Attendance approved successfully", "success");
    } catch (err) {
      console.error("Approve error:", err.message);
      showMessage("Error approving attendance", "error");
    } finally {
      setActionLoadingId(null);
    }
  };

  // ==============
  // REJECT
  // ==============
  const handleReject = async (id, reason) => {
    try {
      setActionLoadingId(id);

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
      setActionLoadingId(null);
    }
  };

  // ==============
  // CONFIRM ACTION DELETE / SAVE / UPDATE
  // ==============
  async function handleConfirmAction(formValues) {
    try {
      // DELETE
      if (modalType === "delete") {
        await deleteRow(selectedRowId);
      }

      // SAVE OR UPDATE
      if (modalType === "save") {
        const data = { ...pendingSaveRow };

        /**
         * Upload only if new photo selected
         * File object = new capture/photo
         * string URL = existing image already saved
         */
        if (data.photo_url instanceof File) {
          const uploaded = await uploadAttendancePhoto(
            data.photo_url,
            data.employee_id,
          );

          data.photo_url = uploaded.url;
          data.photo_path = uploaded.path; // optional but recommended
        }

        if (data.id) {
          await updateRow(data);
        } else {
          // work_date is a FORM-ONLY field: it exists so the two `time`
          // editors have a calendar date to anchor to (via each column's
          // getReferenceDate), and both clocked_in_at/clocked_out_at already
          // carry it baked in. attendance_activities has no work_date column,
          // so sending it would be a PostgREST 400.
          const { work_date: _workDate, ...insertData } = data;

          await createRow({
            ...insertData,
            // Provenance. This form is a manual HR entry by definition --
            // nothing reaches it from a live clock-in. Without this the row
            // would inherit the 'self_clock_in' column default and wrongly
            // claim the employee clocked themselves in, which would also fire
            // the "You are now clocked in" notification at them.
            entry_method: "hr_backfill",
            created_by: employee?.id ?? null,
            // Approved, NOT Pending -- deliberately matching
            // create_attendance_backfill's own rule for hr_backfill rather
            // than contradicting it. Whoever is using this form is already an
            // authorised approver for this employee under approve_attendance's
            // rules, so routing it back to themselves is a null control; and
            // leaving it Pending would flip hr_flag to 'Pending App Approval'
            // on the very day HR just corrected. Both created_by and
            // approved_by are recorded, so the audit trail shows plainly that
            // the same person did both.
            approval_status: "Approved",
            approved_by: employee?.id ?? null,
            approved_at: new Date().toISOString(),
          });
        }
      }

      // APPROVE OR REJECT
      if (modalType === "approve") {
        await handleApprove(selectedId);
      }

      if (modalType === "reject") {
        await handleReject(selectedId, formValues?.reason);
      }

      // Day mode's roster, Search mode's list, AND the sidebar's per-day
      // punch timeline all need refetching -- see handleClockOut.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["attendance_daily"] }),
        queryClient.invalidateQueries({ queryKey: ["attendance_search"] }),
        queryClient.invalidateQueries({ queryKey: ["attendance_activities"] }),
      ]);

      handleCloseSidebar();
      closeActionModal();
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <>
      {/* SEARCH AND FILTER BAR -- setting the date range here (or Employee/
          Department/Manager/Status) is itself what promotes the page into
          Search mode; leaving everything unset keeps today's day-navigator
          as the default. */}
      <SearchFilterBar
        search={search}
        onSearchChange={setSearch}
        filters={filters}
        onFilterChange={setFilters}
        filterConfig={filterConfig}
        placeholder="Search attendance..."
        enableDateRange
      />

      <PageHeader>
        {/* LAYOUT UI + ACTION BUTTONS */}
        <PageActions
          // layout={layout}
          // setLayout={setLayout}
          // options={layoutOptions}
          actionButtons={[
            {
              name: "Backfill Attendance",
              icon: CalendarPlusIcon,
              onClick: () => setBackfillOpen(true),
              style: "button buttonType5 greenFill buttonFull textXXS",
            },
            {
              // Kept alongside the bulk wizard rather than replaced by it:
              // this is the only path that can attach an attendance PHOTO
              // (see handleConfirmAction's uploadAttendancePhoto branch),
              // which the wizard has no concept of.
              name: "Add Single Activity",
              icon: PlusCircleIcon,
              onClick: () => {
                navigate(`new?${searchParams.toString()}`);
              },
              style: "button buttonType5 buttonFull textXXS",
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

      {/* STATUS TABS -- trimmed hr_flag lookup (self-contained flags only)
          + Absent (paired with dayType=working so it excludes ordinary
          unworked weekends) + On Leave/Worked on Holiday/Worked on
          Weekend daily-use tabs + the 3 payroll-reconciliation flags, one
          flat row (see src/functions/statusTabs.js's extraTabs support,
          including its multi-condition tab shape). */}
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

      {/* DAY NAVIGATOR (Day mode only) -- one page = one calendar day;
          Prev/Next always move by exactly one day, the date input jumps
          directly to any day, and "Today" resets to the default. */}
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

      {/* RESULT NUMBER + NEXT/PREVIOUS PAGE (Search mode only) -- an
          ordinary paginated list spanning however many dates match the
          active filters. */}
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

      {/* TABLE DISPLAY UI */}
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
          // TABLE VIEW
          <DataTable
            data={activities}
            columns={columns}
            rowKey="id"
            onRowClick={handleOpenSidebar}
          />
        ) : (
          // CARD VIEW -- flat grid, one card per employee. No per-date
          // grouping anymore: every page is already exactly one day, so
          // grouping-by-date (the source of the old "overflow to next page"
          // bug) no longer applies.
          <CardLayout style="cardLayout1 cardGapSmall">
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

      {/* DATA SIDEBAR */}
      <AnimatePresence>
        {sidebarOpen && (
          <DataSidebar
            title={
              selectedRow?.id
                ? "Edit Attendance Activity"
                : "Add Attendance Activity"
            }
            icon={PencilSimpleLineIcon}
            open={sidebarOpen}
            onClose={handleCloseSidebar}
            rowData={selectedRow}
            columns={createFormColumns}
            onSave={handleRequestSave}
            onDelete={handleRequestDelete}
            saving={saving}
            deleting={deleting}
            creating={!selectedRow?.id}
            isEditing={!selectedRow?.id}
          >
            {/* PICTURE */}
            {selectedRow?.id && (
              <AttendanceSidebarHR
                selectedRow={selectedRow}
                setSelectedId={setSelectedId}
                setModalType={setModalType}
                setModalOpen={setModalOpen}
                clockOutAttendanceActivity={handleClockOut}
              />
            )}
          </DataSidebar>
        )}
      </AnimatePresence>

      {/* ACTION MODAL */}
      <ActionModal
        open={modalOpen}
        onClose={closeActionModal}
        title={
          modalType === "save"
            ? "Save Attendance"
            : modalType === "delete"
              ? "Delete Attendance"
              : modalType === "approve"
                ? "Approve Attendance"
                : modalType === "reject"
                  ? "Reject Attendance"
                  : null
        }
        description={
          modalType === "save"
            ? "Are you sure you want to save these changes?"
            : modalType === "delete"
              ? "Are you sure you want to delete this attendance?"
              : modalType === "approve"
                ? "Are you sure you want to approve this attendance?"
                : modalType === "reject"
                  ? "Are you sure you want to reject this attendance?"
                  : null
        }
        confirmText={
          modalType === "save"
            ? "Save"
            : modalType === "delete"
              ? "Delete"
              : modalType === "approve"
                ? "Approve"
                : modalType === "reject"
                  ? "Reject"
                  : null
        }
        loading={
          modalType === "save" || modalType === "approve" ? saving : deleting
        }
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
        onConfirm={async (formValues) => {
          handleConfirmAction(formValues);
        }}
        modalType={modalType}
      />

      {/* Bulk backfill. Scope "hr" only decides which employees are OFFERED --
          create_attendance_backfill re-derives the caller's rights per row
          from auth.uid() using approve_attendance's own three-branch test, so
          opening this page does not itself grant anything. */}
      <AttendanceBackfillWizard
        open={backfillOpen}
        onClose={() => setBackfillOpen(false)}
        scope="hr"
        employeeOptions={employees.map((e) => ({
          value: e.id,
          label: e.full_name,
        }))}
        attendanceTypes={attendanceTypes}
      />
    </>
  );
}
