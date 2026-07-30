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
import AttendanceCard from "../../../../../components/attendance/attendanceCard/AttendanceCard";
import AttendanceSidebarHR from "../../../../../components/attendance/attendanceSidebarHR/AttendanceSidebarHR";
import Button from "../../../../../components/buttons/button/Button";
import CardLayout from "../../../../../components/cardLayout/CardLayout";
import ActiveFiltersBar from "../../../../../components/crud/activeFiltersBar/ActiveFiltersBar";
import NoResult from "../../../../../components/crud/noResult/NoResult";
import PageHeader from "../../../../../components/crud/pageHeader/PageHeader";
import PageActions from "../../../../../components/crud/pageActions/PageActions";
import SortBar from "../../../../../components/crud/sortBar/SortBar";
import DataSidebar from "../../../../../components/dataSidebar/DataSidebar";
import DataTable from "../../../../../components/dataTable/DataTable";
import LoadingIcon from "../../../../../components/loadingIcon/LoadingIcon";
import ActionModal from "../../../../../components/modals/actionModal/ActionModal";
import SearchFilterBar from "../../../../../components/searchFilterBar/SearchFilterBar";
// Reuses PageResult's container/layout classes for the day navigator below
// (pageResultContainer/pageNumberContainer) without repurposing the
// row-count PageResult component itself, which doesn't fit a date axis.
import "../../../../../components/crud/pageResult/PageResult.scss";
import { useMessage } from "../../../../../context/MessageContext";
import { useAttendanceActivitiesMetadata } from "../../../../../features/hr/attendance/private/hooks/useAttendanceActivitiesMetadata";
import useAttendanceActivityMutations from "../../../../../features/hr/attendance/private/hooks/useAttendanceActivityMutations";
import useAttendanceDailyList from "../../../../../features/hr/attendance/private/hooks/useAttendanceDailyList";
import useCrudActionState from "../../../../../hooks/useCrudActionState";
import { supabase } from "../../../../../lib/supabaseClient";
import { uploadAttendancePhoto } from "../../../../../services/storage/uploadAttendancePhoto";
import "./AttendanceManagement.scss";
import { createAttendanceActivityFormConfig } from "./createAttendanceActivityFormConfig";
import { getAttendanceActivitiesFilterConfig } from "./filterConfig";
import { getAttendanceActivitiesLayoutConfig } from "./layoutConfig";
import { getAttendanceActivitiesSortConfig } from "./sortConfig";
import { attendanceDailySummaryTableConfig } from "./tableConfig";
import { fetchUnifiedAttendance } from "../../../../../features/hr/attendance/private/api/attendanceOverviewService";

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

  // ONE PAGE = ONE CALENDAR DAY (see useAttendanceDailyList) -- defaults to
  // today, and a day's roster is never split across pages since it's fetched
  // in one shot rather than OFFSET/LIMIT-sliced.
  const {
    data: activities,
    totalCount,
    date,
    search,
    filters,
    sortBy,
    sortOrder,
    activeFilters,
    hasActiveFilters,
    setDate,
    goToPreviousDay,
    goToNextDay,
    goToToday,
    setSearch,
    setFilters,
    setSortBy,
    setSortOrder,
    resetParams,
    isLoading: attendanceActivitiesLoading,
    isFetching,
    error,
  } = useAttendanceDailyList({
    queryKey: "attendance_daily",
    queryFn: fetchUnifiedAttendance,
    defaultSortBy: "full_name",
    defaultSortOrder: "ascending",
  });

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

    // Both the day's roster list AND the sidebar's per-day punch timeline
    // (AttendanceSidebarHR's own useQuery, keyed ["attendance_activities",
    // employee_uuid, work_date]) need refetching -- these are two different
    // query keys since the list itself was renamed to "attendance_daily".
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["attendance_daily"] }),
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
  async function handleConfirmAction(reason) {
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
        await handleReject(selectedId, reason);
      }

      // Both the day's roster list AND the sidebar's per-day punch timeline
      // (AttendanceSidebarHR's own useQuery, keyed ["attendance_activities",
      // employee_uuid, work_date]) need refetching -- see handleClockOut.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["attendance_daily"] }),
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
      {/* SEARCH AND FILTER BAR -- no date-range picker here; the day
          navigator below replaces it, since this page is always exactly one
          calendar day, not a range. */}
      <SearchFilterBar
        search={search}
        onSearchChange={setSearch}
        filters={filters}
        onFilterChange={setFilters}
        filterConfig={filterConfig}
        placeholder="Search attendance..."
      />

      <PageHeader>
        {/* LAYOUT UI + ACTION BUTTONS */}
        <PageActions
          layout={layout}
          setLayout={setLayout}
          options={layoutOptions}
          actionButtons={[
            {
              name: "Add Attendance",
              icon: PlusCircleIcon,
              onClick: () => {
                setSelectedRow({});
                setSidebarOpen(true);
              },
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

      {/* DAY NAVIGATOR -- replaces PageResult's row-count pagination. One
          page = one calendar day; Prev/Next always move by exactly one day,
          the date input jumps directly to any day, and "Today" resets to
          the default. */}
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

      {/* TABLE DISPLAY UI */}
      <div className="cardWrapperScroll generalCard">
        {isLoading || isFetching ? (
          <CardLayout style="cardLayoutFlexFull">
            <LoadingIcon />
          </CardLayout>
        ) : !hasData ? (
          <NoResult title="No attendance data for this date." />
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
        onConfirm={async (reason) => {
          handleConfirmAction(reason);
        }}
        requireInput={modalType === "reject"}
        modalType={modalType}
      />
    </>
  );
}
