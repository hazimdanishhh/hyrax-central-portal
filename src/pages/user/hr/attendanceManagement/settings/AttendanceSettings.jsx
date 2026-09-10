// pages/user/hr/attendanceManagement/settings/AttendanceSettings.jsx
import { PencilSimpleLineIcon, PlusCircleIcon } from "@phosphor-icons/react";
import { AnimatePresence } from "framer-motion";
import { useState } from "react";
import CardLayout from "@/components/cardLayout/CardLayout";
import LoadingIcon from "@/components/loadingIcon/LoadingIcon";
import NoResult from "@/components/crud/noResult/NoResult";
import PageHeader from "@/components/crud/pageHeader/PageHeader";
import PageActions from "@/components/crud/pageActions/PageActions";
import DataSidebar from "@/components/dataSidebar/DataSidebar";
import ActionModal from "@/components/modals/actionModal/ActionModal";
import PublicHolidayCard from "@/components/attendance/publicHolidayCard/PublicHolidayCard";
import useCrudActionState from "@/hooks/useCrudActionState";
import { useAttendanceActivitiesMetadata } from "@/features/hr/attendance/private/hooks/useAttendanceActivitiesMetadata";
import usePublicHolidays from "@/features/hr/attendance/private/hooks/usePublicHolidays";
import usePublicHolidayMutations from "@/features/hr/attendance/private/hooks/usePublicHolidayMutations";
import { publicHolidayTableConfig } from "./tableConfig";

/**
 * Attendance > Settings tab -- HR-managed public holiday / company off-day
 * calendar (source: HR2000, supabase/csv/*.csv, one-time seeded via
 * public_holidays_migration.sql). Feeds hr_unified_daily_attendance_view.sql's
 * is_public_holiday/hr_flag directly -- see
 * docs/ATTENDANCE-SELF-SERVICE-ARCHITECTURE.md.
 *
 * Deliberately no pagination/search/sort bar (unlike the Attendance List
 * tab) -- a year's holiday calendar is a small, complete list (~30 rows) HR
 * wants to see all at once, already ordered by date server-side.
 */
export default function AttendanceSettings() {
  const [selectedRow, setSelectedRow] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const {
    modalOpen,
    selectedRowId,
    modalType,
    pendingSaveRow,
    handleRequestSave,
    handleRequestDelete,
    closeActionModal,
  } = useCrudActionState();

  const { holidays, isLoading, isFetching, error } = usePublicHolidays();
  const { workLocations } = useAttendanceActivitiesMetadata();
  const {
    createHoliday,
    updateHoliday,
    deleteHoliday,
    creating,
    updating,
    deleting,
  } = usePublicHolidayMutations();

  const isSaving = creating || updating;
  const hasData = holidays.length > 0;

  const columns = publicHolidayTableConfig({ workLocations });

  function handleOpenSidebar(holiday) {
    setSelectedRow(holiday);
    setSidebarOpen(true);
  }

  function handleCloseSidebar() {
    setSidebarOpen(false);
    setSelectedRow(null);
  }

  async function handleConfirmAction() {
    try {
      if (modalType === "delete") {
        await deleteHoliday(selectedRowId);
      }

      if (modalType === "save") {
        const data = pendingSaveRow;

        if (data.id) {
          await updateHoliday(data);
        } else {
          await createHoliday(data);
        }
      }

      setSidebarOpen(false);
      setSelectedRow(null);
      closeActionModal();
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <>
      <PageHeader>
        <PageActions
          actionButtons={[
            {
              name: "Add Holiday",
              icon: PlusCircleIcon,
              onClick: () => {
                setSelectedRow({});
                setSidebarOpen(true);
              },
              style: "button buttonType5 approval",
            },
          ]}
        />
      </PageHeader>

      <CardLayout style="cardWrapperScroll">
        {isLoading || isFetching ? (
          <CardLayout style="cardLayoutFlexFull">
            <LoadingIcon />
          </CardLayout>
        ) : !hasData || error ? (
          <NoResult />
        ) : (
          <CardLayout style="cardLayout1 cardPaddingSmall cardGapSmall">
            {holidays.map((holiday) => (
              <PublicHolidayCard
                key={holiday.id}
                holiday={holiday}
                onClick={() => handleOpenSidebar(holiday)}
              />
            ))}
          </CardLayout>
        )}
      </CardLayout>

      <AnimatePresence>
        {sidebarOpen && (
          <DataSidebar
            title={
              selectedRow?.id ? "Edit Public Holiday" : "Add Public Holiday"
            }
            icon={PencilSimpleLineIcon}
            open={sidebarOpen}
            onClose={handleCloseSidebar}
            rowData={selectedRow}
            columns={columns}
            onSave={handleRequestSave}
            onDelete={handleRequestDelete}
            saving={isSaving}
            deleting={deleting}
            creating={!selectedRow?.id}
          />
        )}
      </AnimatePresence>

      <ActionModal
        open={modalOpen}
        onClose={closeActionModal}
        title={modalType === "save" ? "Save Holiday" : "Delete Holiday"}
        description={
          modalType === "save"
            ? "Are you sure you want to save these changes?"
            : "Are you sure you want to delete this holiday?"
        }
        confirmText={modalType === "save" ? "Save" : "Delete"}
        loading={modalType === "save" ? isSaving : deleting}
        onConfirm={handleConfirmAction}
        modalType={modalType}
      />
    </>
  );
}
