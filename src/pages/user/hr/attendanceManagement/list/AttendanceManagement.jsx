// pages/user/hr/employees/attendanceManagement/list/AttendanceManagement.jsx
import { PencilSimpleLineIcon, PlusCircleIcon } from "@phosphor-icons/react";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence } from "framer-motion";
import { useState } from "react";
import AttendanceCard from "../../../../../components/attendance/attendanceCard/AttendanceCard";
import AttendanceSidebarHR from "../../../../../components/attendance/attendanceSidebarHR/AttendanceSidebarHR";
import CardLayout from "../../../../../components/cardLayout/CardLayout";
import ActiveFiltersBar from "../../../../../components/crud/activeFiltersBar/ActiveFiltersBar";
import NoResult from "../../../../../components/crud/noResult/NoResult";
import PageHeader from "../../../../../components/crud/pageHeader/PageHeader";
import PageLayout from "../../../../../components/crud/pageLayout/PageLayout";
import PageResult from "../../../../../components/crud/pageResult/PageResult";
import SortBar from "../../../../../components/crud/sortBar/SortBar";
import DataSidebar from "../../../../../components/dataSidebar/DataSidebar";
import DataTable from "../../../../../components/dataTable/DataTable";
import LoadingIcon from "../../../../../components/loadingIcon/LoadingIcon";
import ActionModal from "../../../../../components/modals/actionModal/ActionModal";
import SearchFilterBar from "../../../../../components/searchFilterBar/SearchFilterBar";
import { useMessage } from "../../../../../context/MessageContext";
import { useTheme } from "../../../../../context/ThemeContext";
import { fetchAttendanceActivities } from "../../../../../features/hr/attendance/private/api/attendanceAcitivitiesService";
import { useAttendanceActivitiesMetadata } from "../../../../../features/hr/attendance/private/hooks/useAttendanceActivitiesMetadata";
import useAttendanceActivityMutations from "../../../../../features/hr/attendance/private/hooks/useAttendanceActivityMutations";
import usePaginatedQuery from "../../../../../hooks/usePaginatedQuery";
import { supabase } from "../../../../../lib/supabaseClient";
import { uploadAttendancePhoto } from "../../../../../services/storage/uploadAttendancePhoto";
import "./AttendanceManagement.scss";
import { attendanceActivitiesChangeClockInTimeConfig } from "./changeClockInTimeConfig";
import { attendanceActivitiesChangeClockOutTimeConfig } from "./changeClockOutTimeConfig";
import { getAttendanceActivitiesFilterConfig } from "./filterConfig";
import { getAttendanceActivitiesLayoutConfig } from "./layoutConfig";
import { getAttendanceActivitiesSortConfig } from "./sortConfig";
import { attendanceActivitiesTableConfig } from "./tableConfig";
import { fetchUnifiedAttendance } from "../../../../../features/hr/attendance/private/api/attendanceOverviewService";

/**
 * HR Attendance Management Page
 * This is private HR / employment data
 * Server-side filtering and pagination
 */
export default function AttendanceManagement() {
  const queryClient = useQueryClient();
  const { darkMode } = useTheme();
  const [layout, setLayout] = useState(2); // 1: Card, 2: Table
  const [selectedRow, setSelectedRow] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRowId, setSelectedRowId] = useState(null);
  const [pendingDeleteRow, setPendingDeleteRow] = useState(null);
  const [modalType, setModalType] = useState(null); // "save" | "reject"
  const [pendingSaveRow, setPendingSaveRow] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const { showMessage } = useMessage();
  const [columnMode, setColumnMode] = useState("default");

  // ==============
  // HOOKS
  // ==============

  // MAIN PAGINATED DATA AND TABLE
  const {
    data: activities,
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
    isLoading: attendanceActivitiesLoading,
    isFetching,
    error,
  } = usePaginatedQuery({
    queryKey: "attendance_activities",
    queryFn: fetchUnifiedAttendance,
    pageSize: 100,
    defaultSortBy: "work_date",
    defaultSortOrder: "descending",
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
  const columns = attendanceActivitiesTableConfig({
    employees,
    attendanceTypes,
  });
  const clockInColumns = attendanceActivitiesChangeClockInTimeConfig();
  const clockOutColumns = attendanceActivitiesChangeClockOutTimeConfig();
  const filterConfig = getAttendanceActivitiesFilterConfig({
    employees,
    departments,
    attendanceTypes,
  });

  // ==============
  // COLUMNS
  // ==============
  const currentColumns =
    columnMode === "clockIn"
      ? clockInColumns
      : columnMode === "clockOut"
        ? clockOutColumns
        : columns;

  // ==============
  // DATA LOADING
  // ==============
  const isLoading = attendanceActivitiesLoading || metadataLoading;
  const hasData = activities.length > 0;

  // ==============
  // GROUP BY DATE
  // ==============
  const groupedByDate = activities.reduce((acc, activity) => {
    const date = activity.work_date || "Unknown Date";
    if (!acc[date]) acc[date] = [];
    acc[date].push(activity);
    return acc;
  }, {});

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
  // SAVE + UPDATE
  // ==============
  function handleRequestSave(data) {
    setPendingSaveRow(data);
    setModalType("save");
    setModalOpen(true);
  }

  // ==============
  // DELETE
  // ==============
  function handleRequestDelete(data) {
    setPendingDeleteRow(data);
    setSelectedRowId(data.id);
    setModalType("delete");
    setModalOpen(true);
  }

  // ==============
  // CLOCKING OUT
  // ==============
  const handleClockOut = async (id) => {
    await clockOutAttendanceActivity(id);

    await queryClient.invalidateQueries({
      queryKey: ["attendance_activities"],
    });

    setSidebarOpen(false);
  };

  // ==============
  // APPROVE
  // ==============
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const handleApprove = async (id) => {
    try {
      setActionLoadingId(id);

      const { error } = await supabase.rpc("approve_attendance", {
        activity_id: id,
      });

      showMessage("Attendance approved successfully", "success");

      if (error) throw error;
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
      showMessage("Attendance rejected successfully", "success");

      if (error) throw error;
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

      await queryClient.invalidateQueries({
        queryKey: ["attendance_activities"],
      });

      setModalOpen(false);
      setSidebarOpen(false);
      setSelectedRow(null);
      setPendingSaveRow(null);
      setModalType(null);
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <>
      {/* SEARCH AND FILTER BAR */}
      <SearchFilterBar
        search={search}
        onSearchChange={setSearch}
        filters={filters}
        onFilterChange={setFilters}
        filterConfig={filterConfig}
        placeholder="Search attendance..."
        enableDateRange
        // disableSearch
      />

      <PageHeader>
        {/* LAYOUT UI + ACTION BUTTONS */}
        <PageLayout
          noLayout={true}
          layout={layout}
          setLayout={setLayout}
          options={layoutOptions}
          addButton={{
            name: "Add Attendance",
            icon: PlusCircleIcon,
            onClick: () => {
              setSelectedRow({});
              setSidebarOpen(true);
            },
          }}
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
        data={activities}
        totalCount={totalCount}
        page={page}
        setPage={setPage}
        totalPages={totalPages}
        error={error}
      />

      {/* TABLE DISPLAY UI */}
      <div className="cardWrapperScroll generalCard">
        {isLoading || isFetching ? (
          <CardLayout style="cardLayoutFlexFull">
            <LoadingIcon />
          </CardLayout>
        ) : !hasData ? (
          <NoResult />
        ) : layout === 1 ? (
          // TABLE LAYOUT
          <DataTable
            data={activities}
            columns={columns}
            rowKey="id"
            onRowClick={handleOpenSidebar}
          />
        ) : (
          // LIST LAYOUT
          <CardLayout style="cardLayout1 cardPaddingSmall">
            {Object.entries(groupedByDate).map(([date, activities]) => (
              <CardLayout
                key={date}
                style="cardLayout1 cardPaddingSmall cardGapSmall"
              >
                {/* Date Header */}
                <h4 className="textXS">{date}</h4>
                {activities.map((activity) => (
                  <AttendanceCard
                    key={activity.id}
                    activity={activity}
                    onClick={() => handleOpenSidebar(activity)}
                    // onClick={() => setColumnMode("clockIn")}
                    // onClick={() => {
                    //   setSelectedRow(activity);
                    //   setColumnMode("clockIn");
                    //   setSidebarOpen(true);
                    // }}
                  />
                ))}
              </CardLayout>
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
            columns={currentColumns}
            onSave={handleRequestSave}
            onDelete={handleRequestDelete}
            saving={saving}
            deleting={deleting}
            creating={!selectedRow?.id}
            isEditing={!selectedRow?.id}
            // columns={!selectedRow?.id ? columns : []}
            // cannotUpdate={selectedRow?.id}
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
        onClose={() => setModalOpen(false)}
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
