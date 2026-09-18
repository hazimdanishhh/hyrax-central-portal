// pages/user/hr/attendanceManagement/settings/AttendanceSettings.jsx
import { PencilSimpleLineIcon, PlusCircleIcon } from "@phosphor-icons/react";
import { AnimatePresence } from "framer-motion";
import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import CardLayout from "@/components/cardLayout/CardLayout";
import LoadingIcon from "@/components/loadingIcon/LoadingIcon";
import NoResult from "@/components/crud/noResult/NoResult";
import PageHeader from "@/components/crud/pageHeader/PageHeader";
import PageActions from "@/components/crud/pageActions/PageActions";
import SearchFilterBar from "@/components/searchFilterBar/SearchFilterBar";
import DataSidebar from "@/components/dataSidebar/DataSidebar";
import ActionModal from "@/components/modals/actionModal/ActionModal";
import PublicHolidayCard from "@/components/attendance/publicHolidayCard/PublicHolidayCard";
import useCrudActionState from "@/hooks/useCrudActionState";
import { useAttendanceActivitiesMetadata } from "@/features/hr/attendance/private/hooks/useAttendanceActivitiesMetadata";
import usePublicHolidays from "@/features/hr/attendance/private/hooks/usePublicHolidays";
import usePublicHolidayMutations from "@/features/hr/attendance/private/hooks/usePublicHolidayMutations";
import { publicHolidayTableConfig } from "./tableConfig";
import { getHolidaysFilterConfig } from "./filterConfig";

/**
 * Attendance > Settings tab -- HR-managed public holiday / company off-day
 * calendar (source: HR2000, supabase/csv/*.csv, one-time seeded via
 * public_holidays_migration.sql). Feeds hr_unified_daily_attendance_view.sql's
 * is_public_holiday/hr_flag directly -- see
 * docs/ATTENDANCE-SELF-SERVICE-ARCHITECTURE.md.
 *
 * Deliberately no pagination/sort bar (unlike the Attendance List tab) -- a
 * year's holiday calendar is a small, complete list (~30 rows) HR wants to
 * see all at once, already ordered by date server-side. Search/category/
 * work-location filtering (see filterConfig.js) is client-side only, since
 * the whole calendar is already loaded -- no service/RPC change needed.
 */
export default function AttendanceSettings() {
  const navigate = useNavigate();
  const { holidayId } = useParams();
  const [searchParams] = useSearchParams();

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

  const columns = publicHolidayTableConfig({ workLocations });

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({ category: "", workLocation: "" });
  const filterConfig = getHolidaysFilterConfig({ workLocations });

  // Client-side only -- see filterConfig.js's header comment for why (the
  // whole calendar is already loaded, no service/RPC round trip to filter
  // through).
  const filteredHolidays = useMemo(() => {
    const q = search.trim().toLowerCase();

    return holidays.filter((holiday) => {
      if (q) {
        const matchesSearch =
          holiday.name?.toLowerCase().includes(q) ||
          holiday.code?.toLowerCase().includes(q);
        if (!matchesSearch) return false;
      }

      if (filters.category && holiday.category !== filters.category) {
        return false;
      }

      // A location-specific filter still shows universal holidays
      // (work_location null = "applies to all locations") -- those apply
      // regardless of which location HR is looking at.
      if (
        filters.workLocation &&
        holiday.work_location != null &&
        String(holiday.work_location.id) !== filters.workLocation
      ) {
        return false;
      }

      return true;
    });
  }, [holidays, search, filters]);

  const hasData = filteredHolidays.length > 0;

  // URL-driven (:holidayId), same pattern as EmployeeManagement.jsx -- no
  // separate by-id fallback fetch needed here (unlike most other pages in
  // this pass): usePublicHolidays() deliberately has no pagination/filter
  // at all, the whole calendar is always loaded in one shot, so any valid
  // holidayId is always already present in `holidays` once it's loaded.
  // String(h.id) -- public_holidays.id is a bigint (see
  // public_holidays_migration.sql), which comes back from Supabase as a JS
  // number, while useParams() always yields a string; comparing them
  // directly never matched, so the sidebar never opened despite the URL
  // correctly carrying the id.
  const selectedRow = useMemo(() => {
    if (holidayId === "new") return {};
    if (!holidayId) return null;

    return holidays?.find((h) => String(h.id) === holidayId) || null;
  }, [holidayId, holidays]);

  const sidebarOpen = !!selectedRow;

  function handleOpenSidebar(holiday) {
    navigate(`${holiday.id}?${searchParams.toString()}`);
  }

  function handleCloseSidebar() {
    navigate(`/app/hr/attendance/settings?${searchParams.toString()}`);
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

      handleCloseSidebar();
      closeActionModal();
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <>
      <SearchFilterBar
        search={search}
        onSearchChange={setSearch}
        filters={filters}
        onFilterChange={setFilters}
        filterConfig={filterConfig}
        placeholder="Search by holiday name or code..."
      />

      <PageHeader>
        <PageActions
          actionButtons={[
            {
              name: "Add Holiday",
              icon: PlusCircleIcon,
              onClick: () => {
                navigate(`new?${searchParams.toString()}`);
              },
              style: "button buttonType5 greenFill buttonFull textXXS",
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
          <CardLayout style="cardLayout1 cardGapSmall">
            {filteredHolidays.map((holiday) => (
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
