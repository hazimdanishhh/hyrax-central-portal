// pages/user/hr/leaveManagement/leaveTypes/LeaveTypes.jsx
import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { PencilSimpleLineIcon, PlusCircleIcon } from "@phosphor-icons/react";
import { AnimatePresence } from "framer-motion";
import CardLayout from "@/components/cardLayout/CardLayout";
import LoadingIcon from "@/components/loadingIcon/LoadingIcon";
import NoResult from "@/components/crud/noResult/NoResult";
import PageHeader from "@/components/crud/pageHeader/PageHeader";
import PageActions from "@/components/crud/pageActions/PageActions";
import SearchFilterBar from "@/components/searchFilterBar/SearchFilterBar";
import DataTable from "@/components/dataTable/DataTable";
import DataSidebar from "@/components/dataSidebar/DataSidebar";
import ActionModal from "@/components/modals/actionModal/ActionModal";
import useCrudActionState from "@/hooks/useCrudActionState";
import useLeaveTypeMutations, {
  useLeaveTypes,
} from "@/features/hr/leave/private/hooks/useLeaveTypes";
import { leaveTypeTableConfig } from "./tableConfig";
import { getLeaveTypesFilterConfig } from "./filterConfig";

/**
 * Leave Management > Leave Types tab -- HR's classification of the leave
 * vocabulary that HR2000 sends.
 *
 * The counterpart to the Leave Records tab, and the opposite of it in one
 * important way: records are READ-ONLY (leave_ledger_entries is a full
 * snapshot of HR2000, so any edit would be discarded by the next sync),
 * while types are WRITABLE, because `is_paid` and `needs_hr_confirmation`
 * are two fields HR2000 never sends and the sync only ever looks types up
 * by `code`.
 *
 * WHY THIS TAB EXISTS. Until 2026-09-23 an unknown leave code aborted the
 * entire leave upload ("nothing was written") and there was no way to add
 * the missing type from the portal, so the sync stayed blocked. The sync now
 * auto-creates unknown codes instead -- defaulting to is_paid = true, which
 * is right more often than not but is exactly WRONG for a new no-pay type,
 * and an unpaid type reported as paid overstates paidLeaveDaysTotal in the
 * payroll package. `needs_hr_confirmation` plus this tab is what bounds that
 * exposure: auto-created types sort to the top (see fetchAllLeaveTypes) so
 * the first thing HR sees here is the vocabulary the sync invented.
 *
 * No delete, anywhere -- not in the service, the hook, or the policies.
 * leave_ledger_entries.leave_type_id references this table, so deleting a
 * type in use fails on the FK, and deleting an unused one only invites the
 * next sync to recreate it from the source file. Retirement is
 * is_active = false.
 *
 * Deliberately no pagination/sort bar (like the Settings tab, unlike the
 * Records tab) -- the vocabulary is a small, complete list HR wants to see
 * at once, already ordered server-side. Search and filtering are client-side
 * for the same reason; see filterConfig.js.
 */
export default function LeaveTypes() {
  const navigate = useNavigate();
  const { leaveTypeId } = useParams();
  const [searchParams] = useSearchParams();

  const {
    modalOpen,
    modalType,
    pendingSaveRow,
    handleRequestSave,
    closeActionModal,
  } = useCrudActionState();

  const { leaveTypes, isLoading, isFetching, error } = useLeaveTypes();
  const { createLeaveType, updateLeaveType, creating, updating } =
    useLeaveTypeMutations();

  const isSaving = creating || updating;

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({
    needsReview: "",
    isPaid: "",
    isActive: "",
  });
  const filterConfig = getLeaveTypesFilterConfig();

  const filteredTypes = useMemo(() => {
    const q = search.trim().toLowerCase();

    return leaveTypes.filter((type) => {
      if (q) {
        const matchesSearch =
          type.code?.toLowerCase().includes(q) ||
          type.label?.toLowerCase().includes(q) ||
          type.category?.toLowerCase().includes(q);
        if (!matchesSearch) return false;
      }

      // Filter values are the strings "yes"/"no" (SearchFilterBar option
      // values are strings); the columns are booleans, and
      // needs_hr_confirmation is nullable on rows seeded before the column
      // existed -- so compare on the coerced boolean, not on the raw value.
      if (
        filters.needsReview &&
        !!type.needs_hr_confirmation !== (filters.needsReview === "yes")
      ) {
        return false;
      }

      if (filters.isPaid && !!type.is_paid !== (filters.isPaid === "yes")) {
        return false;
      }

      if (
        filters.isActive &&
        !!type.is_active !== (filters.isActive === "yes")
      ) {
        return false;
      }

      return true;
    });
  }, [leaveTypes, search, filters]);

  const hasData = filteredTypes.length > 0;

  // URL-driven (:leaveTypeId), same pattern as AttendanceSettings.jsx -- and
  // like it, no by-id fallback fetch is needed: useLeaveTypes() has no
  // pagination or filter at all, so any valid id is always already present.
  // String(t.id) because leave_ledger_types.id is a bigint (a JS number off
  // the wire) while useParams() always yields a string.
  const selectedRow = useMemo(() => {
    if (leaveTypeId === "new") return {};
    if (!leaveTypeId) return null;

    return leaveTypes?.find((t) => String(t.id) === leaveTypeId) || null;
  }, [leaveTypeId, leaveTypes]);

  const sidebarOpen = !!selectedRow;
  const isCreating = !selectedRow?.id;

  // `creating` drives whether `code` is editable -- it is the key the sync
  // matches on (`lt.code = v.leave_type_raw`), so it can be set once and
  // never changed. leaveTypesService.updateLeaveType strips it as a backstop.
  const columns = leaveTypeTableConfig({ creating: isCreating });

  function handleOpenSidebar(type) {
    navigate(`${type.id}?${searchParams.toString()}`);
  }

  function handleCloseSidebar() {
    navigate(`/app/hr/leaves/types?${searchParams.toString()}`);
  }

  async function handleConfirmAction() {
    try {
      const data = pendingSaveRow;

      if (data?.id) {
        await updateLeaveType(data);
      } else {
        await createLeaveType(data);
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
        placeholder="Search by code, label or category..."
      />

      <PageHeader>
        <PageActions
          actionButtons={[
            {
              name: "Add Leave Type",
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
          <NoResult
            title={
              leaveTypes.length > 0
                ? "No leave types match these filters."
                : "No leave types yet -- import the HR2000 leave CSV and any new codes will be created here."
            }
          />
        ) : (
          <DataTable
            data={filteredTypes}
            columns={columns}
            onRowClick={handleOpenSidebar}
          />
        )}
      </CardLayout>

      <AnimatePresence>
        {sidebarOpen && (
          <DataSidebar
            title={isCreating ? "Add Leave Type" : "Edit Leave Type"}
            icon={PencilSimpleLineIcon}
            open={sidebarOpen}
            onClose={handleCloseSidebar}
            rowData={selectedRow}
            columns={columns}
            onSave={handleRequestSave}
            saving={isSaving}
            creating={isCreating}
            // Required, not cosmetic: DataForm renders its Delete button on
            // any non-creating form unless told not to, and there is no
            // delete path here at all -- no mutation, no service call, no
            // DELETE policy. Retire with is_active instead.
            hideDelete
          />
        )}
      </AnimatePresence>

      <ActionModal
        open={modalOpen}
        onClose={closeActionModal}
        title="Save Leave Type"
        description="Are you sure you want to save these changes? Changing whether a type is paid moves the paid/unpaid split on Payroll Export."
        confirmText="Save"
        loading={isSaving}
        onConfirm={handleConfirmAction}
        modalType={modalType}
      />
    </>
  );
}
