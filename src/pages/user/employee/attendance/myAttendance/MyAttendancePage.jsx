// pages/user/hr/employees/attendanceManagement/list/AttendanceManagement.jsx
import {
  CheckIcon,
  PencilSimpleLineIcon,
  PlusCircleIcon,
  SignInIcon,
  SignOutIcon,
  UsersFourIcon,
  XIcon,
} from "@phosphor-icons/react";
import CardLayout from "../../../../../components/cardLayout/CardLayout";
import LoadingIcon from "../../../../../components/loadingIcon/LoadingIcon";
import { useTheme } from "../../../../../context/ThemeContext";
import { useEffect, useState } from "react";
import CardWrapper from "../../../../../components/cardWrapper/CardWrapper";
import Breadcrumbs from "../../../../../components/breadcrumbs/Breadcrumbs";
import SearchFilterBar from "../../../../../components/searchFliterBar/SearchFilterBar";
import DataTable from "../../../../../components/dataTable/DataTable";
import DataSidebar from "../../../../../components/dataSidebar/DataSidebar";
import { AnimatePresence } from "framer-motion";
import ActiveFiltersBar from "../../../../../components/crud/activeFiltersBar/ActiveFiltersBar";
import PageHeader from "../../../../../components/crud/pageHeader/PageHeader";
import { useSearchParams } from "react-router-dom";
import ActionModal from "../../../../../components/modals/actionModal/ActionModal";
import PageResult from "../../../../../components/crud/pageResult/PageResult";
import OverviewCards from "../../../../../components/crud/overviewCards/OverviewCards";
import PageLayout from "../../../../../components/crud/pageLayout/PageLayout";
import { useQueryClient } from "@tanstack/react-query";
import SortBar from "../../../../../components/crud/sortBar/SortBar";
import NoResult from "../../../../../components/crud/noResult/NoResult";
import { getAttendanceActivitiesLayoutConfig } from "./layoutConfig";
import { getAttendanceActivitiesSortConfig } from "./sortConfig";
import { attendanceActivitiesTableConfig } from "./tableConfig";
import { getAttendanceActivitiesFilterConfig } from "./filterConfig";
import StatusBadge from "../../../../../components/status/statusBadge/StatusBadge";
import { uploadAttendancePhoto } from "../../../../../services/storage/uploadAttendancePhoto";
import AttendanceCard from "../../../../../components/attendance/attendanceCard/AttendanceCard";
import Button from "../../../../../components/buttons/button/Button";
import { supabase } from "../../../../../lib/supabaseClient";
import { useMessage } from "../../../../../context/MessageContext";
import AttendanceType from "../../../../../components/attendance/attendanceType/AttendanceType";
import AttendanceSidebarHR from "../../../../../components/attendance/attendanceSidebarHR/AttendanceSidebarHR";
import { fetchMyAttendanceActivities } from "../../../../../services/attendanceActivitiesServices/myAttendanceActivitiesService";
import usePaginatedQuery from "../../../../../hooks/usePaginatedQuery";
import { useAttendanceActivitiesMetadata } from "../../../../../hooks/attendanceActivities/useAttendanceActivitiesMetadata";
import { useEmployee } from "../../../../../context/EmployeeContext";
import useAttendanceActivityMutations from "../../../../../hooks/attendanceActivities/useAttendanceActivityMutations";

/**
 * HR Attendance Management Page
 * This is private HR / employment data
 * Server-side filtering and pagination
 */
export default function MyAttendancePage() {
  const { employee } = useEmployee();
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
  const employeeId = employee?.id;

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
    queryFn: fetchMyAttendanceActivities,
    pageSize: 20,
    defaultSortBy: "clocked_in_at",
    defaultSortOrder: "descending",

    // EXTRA PARAMS PASSED TO SERVICE
    extraParams: {
      employeeId: employee?.id,
    },

    // GENERIC QUERY CONTROL
    enabled: !!employee?.id,
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
  const filterConfig = getAttendanceActivitiesFilterConfig({
    employees,
    departments,
    attendanceTypes,
  });

  // ==============
  // DATA LOADING
  // ==============
  const isLoading = attendanceActivitiesLoading || metadataLoading;
  const hasData = activities.length > 0;

  // ==============
  // GROUP BY DATE
  // ==============
  const groupedByDate = activities.reduce((acc, activity) => {
    const date = activity.clocked_in_date || "Unknown Date";
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
      queryKey: ["attendance_activities", employeeId],
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
        queryKey: ["attendance_activities", employeeId],
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
            columns={columns}
            onSave={handleRequestSave}
            onDelete={handleRequestDelete}
            saving={saving}
            deleting={deleting}
            creating={!selectedRow?.id}
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
