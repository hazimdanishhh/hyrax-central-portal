// pages/user/it/it_assets/IT_Assets.jsx
import {
  CaretLeftIcon,
  CaretRightIcon,
  CheckIcon,
  ClipboardTextIcon,
  DesktopIcon,
  FloppyDiskIcon,
  LaptopIcon,
  MonitorIcon,
  PencilSimpleLineIcon,
  PercentIcon,
  PlusCircleIcon,
  SignInIcon,
  SignOutIcon,
  SpinnerIcon,
  SquaresFourIcon,
  TableIcon,
  UsersThreeIcon,
  XIcon,
} from "@phosphor-icons/react";
import CardLayout from "../../../../components/cardLayout/CardLayout";
import CardSection from "../../../../components/cardSection/CardSection";
import LoadingIcon from "../../../../components/loadingIcon/LoadingIcon";
import { useTheme } from "../../../../context/ThemeContext";
import { useEffect, useState } from "react";
import Button from "../../../../components/buttons/button/Button";
import CardWrapper from "../../../../components/cardWrapper/CardWrapper";
import Breadcrumbs from "../../../../components/breadcrumbs/Breadcrumbs";
import SearchFilterBar from "../../../../components/searchFliterBar/SearchFilterBar";
import useSearchFilter from "../../../../hooks/useSearchFliter";
import DataTable from "../../../../components/dataTable/DataTable";
import DataSidebar from "../../../../components/dataSidebar/DataSidebar";
import { AnimatePresence, motion } from "framer-motion";
import ActiveFiltersBar from "../../../../components/crud/activeFiltersBar/ActiveFiltersBar";
import PageHeader from "../../../../components/crud/pageHeader/PageHeader";
import { getAttendanceActivitiesFilterConfig } from "./filterConfig";
import { attendanceActivityApprovalConfig } from "../../../../data/attendanceActivityApprovalConfig";
import useAttendanceTypes from "../../../../hooks/useAttendanceTypes";
import { supabase } from "../../../../lib/supabaseClient";
import useEmployeeAttendanceActivities from "../../../../hooks/useEmployeeAttendanceActivities";
import StatusBadge from "../../../../components/status/statusBadge/StatusBadge";
import ActionModal from "../../../../components/modals/actionModal/ActionModal";
import useSubordinatesAttendanceActivities from "../../../../hooks/useSubordinatesAttendanceActivities";
import useSubordinates from "../../../../hooks/useSubordinates";
import "./Attendance.scss";

export default function Attendance() {
  const { darkMode } = useTheme();

  const {
    attendanceActivities: myAttendance,
    setAttendanceActivities,
    loading,
    error,
    refetch: refetchMyAttendance,
  } = useEmployeeAttendanceActivities();
  const {
    attendanceActivities: teamAttendance,
    refetch: refetchTeamAttendance,
  } = useSubordinatesAttendanceActivities();

  const [layout, setLayout] = useState(2); // 1: Card, 2: Table
  const [tab, setTab] = useState(1); // 1: My Attendance, 2: Team Attendance
  const [selectedAttendance, setSelectedAttendance] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState(null); // "approve" | "reject"
  const [selectedId, setSelectedId] = useState(null);
  const [showName, setShowName] = useState(false);

  const attendanceActivities = tab === 1 ? myAttendance : teamAttendance;

  // ==============
  // Hooks for attendanceActivity filter data
  // ==============
  const { attendanceTypes, loading: attendanceTypesLoading } =
    useAttendanceTypes();
  const { subordinates, loading: subordinatesLoading } = useSubordinates();

  // ==============
  // Table Config
  // ==============
  const columns = attendanceActivityApprovalConfig({ attendanceTypes });

  // ==============
  // Filter Config
  // ==============
  const filterConfig = getAttendanceActivitiesFilterConfig({ subordinates });

  // ==============
  // Search + Filter logic for IT attendanceActivities
  // ==============
  const {
    search,
    setSearch,
    filters,
    setFilters,
    data: filteredData,
  } = useSearchFilter({
    data: attendanceActivities, // `attendanceActivities` is your ITAssetTable data
    searchFields: ["employee_full_name"], // searchable fields
    filterMap: {
      approval_status: (attendanceActivity, value) =>
        attendanceActivity.approval_status === value,
      subordinates: (attendanceActivity, value) =>
        attendanceActivity.employee?.full_name === value,

      startDate: (attendanceActivity, value, filters) => {
        if (!filters.endDate) return true;
        const date = new Date(attendanceActivity.clocked_in_at);
        return date >= new Date(value);
      },

      endDate: (attendanceActivity, value, filters) => {
        if (!filters.startDate) return true;
        const date = new Date(attendanceActivity.clocked_in_at);
        return date <= new Date(value);
      },
    },
  });

  // =====================
  // OVERVIEW METRICS
  // =====================

  // ==============
  // ACTIVE FILTERS
  // ==============
  const activeFilters = Object.entries(filters).filter(
    ([_, value]) => value && value !== "",
  );
  const hasActiveFilters = search || activeFilters.length > 0;

  // parent component or hook
  const rowsPerPage = 20;
  const totalPages = Math.ceil(filteredData.length / rowsPerPage);

  // slice data for current page
  const [currentPage, setCurrentPage] = useState(1);
  const paginatedData = filteredData.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage,
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [filteredData]);

  console.log(activeFilters);

  // ==============
  // GROUP BY DATE
  // ==============
  const groupedByDate = filteredData.reduce((acc, activity) => {
    const date = activity.clocked_in_date || "Unknown Date";
    if (!acc[date]) acc[date] = [];
    acc[date].push(activity);
    return acc;
  }, {});

  // ==============
  // SIDEBAR OPEN & CLOSE
  // ==============
  function handleOpenSidebar(attendanceActivity) {
    setSelectedAttendance(attendanceActivity);
    setSidebarOpen(true);
  }

  function handleCloseSidebar() {
    setSidebarOpen(false);
    setSelectedAttendance(null);
  }

  // ==============
  // SAVE + UPDATE
  // ==============
  async function handleSaveSidebar(data) {
    try {
      if (data.id) {
        // UPDATE
        await updateAsset(data);
      } else {
        // CREATE
        await createAsset(data);
      }

      await refetch();
      setSidebarOpen(false);
      setSelectedAttendance(null);
    } catch (err) {
      console.error(err);
    }
  }

  // ==============
  // DELETE
  // ==============
  async function handleDeleteSidebar(attendanceActivity) {
    try {
      await deleteAsset(attendanceActivity.id);
      await refetch();
      setSidebarOpen(false);
      setSelectedAttendance(null);
    } catch (err) {
      console.error(err);
    }
  }

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

      if (error) throw error;

      await refetchTeamAttendance();
    } catch (err) {
      console.error("Approve error:", err.message);
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

      await refetchTeamAttendance();
    } catch (err) {
      console.error("Reject error:", err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <>
      <section className={darkMode ? "sectionDark" : "sectionLight"}>
        <div className="sectionWrapper">
          <div className="sectionContent">
            <Breadcrumbs icon={ClipboardTextIcon} current="Attendance" />

            <CardWrapper>
              {/* OVERVIEW */}

              {/* TABS */}
              <CardLayout style="cardLayoutFlexStart cardGapSmall cardLayoutNoPadding">
                <Button
                  style={
                    tab === 1
                      ? "button buttonTypeTab textXXS active"
                      : "button buttonTypeTab textXXS"
                  }
                  name="My Attendance"
                  onClick={() => setTab(1)}
                />
                <Button
                  style={
                    tab === 2
                      ? "button buttonTypeTab textXXS active"
                      : "button buttonTypeTab textXXS"
                  }
                  name="Team Attendance"
                  onClick={() => setTab(2)}
                />
              </CardLayout>

              {/* SEARCH AND FILTER BAR */}
              <PageHeader>
                <SearchFilterBar
                  search={search}
                  onSearchChange={setSearch}
                  filters={filters}
                  onFilterChange={setFilters}
                  filterConfig={filterConfig}
                  placeholder="Search Employee..."
                  enableDateRange
                  disableSearch={tab === 1}
                />
              </PageHeader>

              {/* LAYOUT UI + ADD */}
              <PageHeader>
                {layout === 1 ? (
                  <Button
                    icon2={SquaresFourIcon}
                    tooltipName="Card View"
                    style="button buttonType3 textXXS"
                    name="Card View"
                    onClick={() => setLayout(2)}
                  />
                ) : (
                  <Button
                    icon2={TableIcon}
                    tooltipName="Table View"
                    style="button buttonType3 textXXS"
                    name="Table View"
                    onClick={() => setLayout(1)}
                  />
                )}
              </PageHeader>

              {/* ACTIVE FILTERS */}
              <PageHeader>
                {hasActiveFilters && (
                  <ActiveFiltersBar
                    search={search}
                    setSearch={setSearch}
                    filters={activeFilters}
                    setFilters={setFilters}
                    filterConfig={filterConfig}
                  />
                )}
              </PageHeader>

              {/* TABLE DISPLAY UI */}
              {loading ? (
                <LoadingIcon />
              ) : layout === 1 ? (
                <>
                  <CardLayout style=" cardLayoutFlexFull cardGapLarge cardLayoutEnd cardLayoutNoPadding">
                    <p className="textRegular textXXS">
                      <strong>Total Result: </strong>
                      {paginatedData.length} / {filteredData.length}
                    </p>

                    <CardLayout style="cardLayoutFlex cardGapLarge cardLayoutNoPadding">
                      <p className="textRegular textXXS">
                        Page: {currentPage}/{totalPages}
                      </p>

                      <Button
                        icon={CaretLeftIcon}
                        style="button iconButton2 textXXS"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage((p) => p - 1)}
                      />

                      <Button
                        icon={CaretRightIcon}
                        style="button iconButton2 textXXS"
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage((p) => p + 1)}
                      />
                    </CardLayout>
                  </CardLayout>
                  <DataTable
                    data={paginatedData}
                    columns={columns}
                    rowKey="id"
                    onRowClick={handleOpenSidebar}
                  />
                </>
              ) : (
                <>
                  <CardLayout style=" cardLayoutFlexFull cardGapLarge cardLayoutEnd cardLayoutNoPadding">
                    {!paginatedData.length ? (
                      <p className="textRegular textXXS">No results found</p>
                    ) : error ? (
                      <p className="textRegular textXXS">
                        Error loading results
                      </p>
                    ) : (
                      <p className="textRegular textXXS">
                        <strong>Total Result: </strong>
                        {paginatedData.length} / {filteredData.length}
                      </p>
                    )}

                    <CardLayout style="cardLayoutFlex cardGapLarge cardLayoutNoPadding">
                      <p className="textRegular textXXS">
                        Page: {currentPage}/{totalPages}
                      </p>

                      <Button
                        icon={CaretLeftIcon}
                        style="button iconButton2 textXXS"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage((p) => p - 1)}
                      />

                      <Button
                        icon={CaretRightIcon}
                        style="button iconButton2 textXXS"
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage((p) => p + 1)}
                      />
                    </CardLayout>
                  </CardLayout>
                  <div className="cardWrapperScroll generalCard cardPaddingSmall">
                    {Object.entries(groupedByDate).map(([date, activities]) => (
                      <CardLayout key={date} style="cardLayout1 generalCard">
                        {/* Date Header */}
                        <h4 className="textXS cardDateHeader">{date}</h4>

                        {/* Activities for that date */}
                        {activities.map((attendanceActivity) => (
                          <CardLayout
                            style="generalCard cardLayoutFlex cardLayoutFlexRow cardLayoutSpaceBetween cardPaddingSmall"
                            key={attendanceActivity.id}
                          >
                            {tab === 2 && (
                              <>
                                <a
                                  className="listEmployeePhoto"
                                  href={`/app/employees/${attendanceActivity.employee?.id}`}
                                  onMouseEnter={() => setShowName(true)}
                                  onMouseLeave={() => setShowName(false)}
                                >
                                  <img
                                    src={
                                      attendanceActivity.employee?.profile
                                        ?.avatar_url
                                        ? attendanceActivity.employee?.profile
                                            .avatar_url
                                        : "/profilePhoto/default.webp"
                                    }
                                    alt={attendanceActivity.employee?.full_name}
                                  />
                                  <AnimatePresence mode="wait">
                                    {showName && (
                                      <motion.div
                                        className={
                                          darkMode
                                            ? "textRegular textXXXS listEmployeePhotoName sectionDark"
                                            : "textRegular textXXXS listEmployeePhotoName sectionLight"
                                        }
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                      >
                                        {attendanceActivity.employee?.full_name}
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </a>
                                <p className="textXXS">
                                  {attendanceActivity.employee?.preferred_name}
                                </p>
                              </>
                            )}

                            <p className="textXXS textBold">
                              {attendanceActivity.attendance_type?.name}
                            </p>
                            <CardLayout style="cardLayoutFlex cardLayoutNoPadding cardGapSmall clockInPill">
                              <SignInIcon />
                              <p className="textXXS">
                                {attendanceActivity.clocked_in_time}
                              </p>
                            </CardLayout>
                            <CardLayout style="cardLayoutFlex cardLayoutNoPadding cardGapSmall clockOutPill">
                              <SignOutIcon />
                              <p className="textXXS">
                                {attendanceActivity.clocked_out_time}
                              </p>
                            </CardLayout>
                            <StatusBadge
                              status={attendanceActivity.approval_status}
                            />
                            {attendanceActivity.approval_status === "Pending" &&
                              tab === 2 &&
                              attendanceActivity.clocked_out_time && (
                                <CardLayout style="cardLayoutFlex cardGapMedium cardLayoutNoPadding">
                                  <Button
                                    onClick={() => {
                                      setSelectedId(attendanceActivity.id);
                                      setModalType("approve");
                                      setModalOpen(true);
                                    }}
                                    icon={CheckIcon}
                                    style="iconButton2 approval"
                                  />
                                  <Button
                                    onClick={() => {
                                      setSelectedId(attendanceActivity.id);
                                      setModalType("reject");
                                      setModalOpen(true);
                                    }}
                                    icon={XIcon}
                                    style="iconButton2 rejection"
                                  />
                                </CardLayout>
                              )}
                          </CardLayout>
                        ))}
                      </CardLayout>
                    ))}
                  </div>
                </>
              )}
            </CardWrapper>
          </div>
        </div>
      </section>

      {/* DATA SIDEBAR */}
      <AnimatePresence>
        {sidebarOpen && (
          <DataSidebar
            title={
              selectedAttendance?.id ? "Edit Attendance" : "Add Attendance"
            }
            icon={PencilSimpleLineIcon}
            open={sidebarOpen}
            onClose={handleCloseSidebar}
            rowData={selectedAttendance}
            columns={columns}
            onSave={handleSaveSidebar}
            onDelete={handleDeleteSidebar}
            saving={saving}
            deleting={deleting}
            creating={!selectedAttendance?.id}
          />
        )}
      </AnimatePresence>

      {/* ACTION MODAL */}
      <ActionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          modalType === "approve" ? "Approve Attendance" : "Reject Attendance"
        }
        description={
          modalType === "approve"
            ? "Are you sure you want to approve this attendance?"
            : "Please provide a reason for rejection."
        }
        confirmText={modalType === "approve" ? "Approve" : "Reject"}
        requireInput={modalType === "reject"}
        loading={actionLoadingId === selectedId}
        onConfirm={async (reason) => {
          if (modalType === "approve") {
            await handleApprove(selectedId);
          } else {
            await handleReject(selectedId, reason);
          }
          setModalOpen(false);
        }}
        modalType={modalType}
      />
    </>
  );
}
