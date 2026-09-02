// pages/user/hr/attendanceManagement/list/AttendanceManagement.jsx
import {
  CaretLeftIcon,
  CaretRightIcon,
  PencilSimpleLineIcon,
  PlusCircleIcon,
} from "@phosphor-icons/react";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import AttendanceCard from "../../../../../components/attendance/attendanceCard/AttendanceCard";
import AttendanceSidebarHR from "../../../../../components/attendance/attendanceSidebarHR/AttendanceSidebarHR";
import Button from "../../../../../components/buttons/button/Button";
import CardLayout from "../../../../../components/cardLayout/CardLayout";
import ActiveFiltersBar from "../../../../../components/crud/activeFiltersBar/ActiveFiltersBar";
import NoResult from "../../../../../components/crud/noResult/NoResult";
import PageHeader from "../../../../../components/crud/pageHeader/PageHeader";
import PageActions from "../../../../../components/crud/pageActions/PageActions";
import PageResult from "../../../../../components/crud/pageResult/PageResult";
import SortBar from "../../../../../components/crud/sortBar/SortBar";
import DataSidebar from "../../../../../components/dataSidebar/DataSidebar";
import DataTable from "../../../../../components/dataTable/DataTable";
import LoadingIcon from "../../../../../components/loadingIcon/LoadingIcon";
import ActionModal from "../../../../../components/modals/actionModal/ActionModal";
import SearchFilterBar from "../../../../../components/searchFilterBar/SearchFilterBar";
import { useMessage } from "../../../../../context/MessageContext";
import { useAttendanceActivitiesMetadata } from "../../../../../features/hr/attendance/private/hooks/useAttendanceActivitiesMetadata";
import useAttendanceActivityMutations from "../../../../../features/hr/attendance/private/hooks/useAttendanceActivityMutations";
import useAttendanceDailyList from "../../../../../features/hr/attendance/private/hooks/useAttendanceDailyList";
import usePaginatedQuery from "../../../../../hooks/usePaginatedQuery";
import useCrudActionState from "../../../../../hooks/useCrudActionState";
import { supabase } from "../../../../../lib/supabaseClient";
import { uploadAttendancePhoto } from "../../../../../services/storage/uploadAttendancePhoto";
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
 * HR Attendance Management Page
 * This is private HR / employment data
 * Server-side filtering and pagination
 */
export default function AttendanceManagement() {
  const queryClient = useQueryClient();
  const [layout, setLayout] = useState(1); // 1: Card, 2: Table
  const [selectedRow, setSelectedRow] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const { showMessage } = useMessage();

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
  });
  const filterConfig = getAttendanceActivitiesFilterConfig({
    employees,
    departments,
  });

  // ==============
  // DATA LOADING
  // ==============
  const isLoading = attendanceActivitiesLoading || metadataLoading;
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

    setSidebarOpen(false);
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
          await createRow({
            ...data,
            approval_status: "Pending",
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

      setSidebarOpen(false);
      setSelectedRow(null);
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
              name: "Add Attendance",
              icon: PlusCircleIcon,
              onClick: () => {
                setSelectedRow({});
                setSidebarOpen(true);
              },
              style: "button buttonType5 approval",
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
    </>
  );
}
