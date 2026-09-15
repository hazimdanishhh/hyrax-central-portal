// pages/user/hr/employees/Employees.jsx
import {
  CheckIcon,
  PencilSimpleLineIcon,
  PlusCircleIcon,
  TrashIcon,
  XIcon,
} from "@phosphor-icons/react";
import { AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import CardLayout from "../../../../../components/cardLayout/CardLayout";
import ActiveFiltersBar from "../../../../../components/crud/activeFiltersBar/ActiveFiltersBar";
import NoResult from "../../../../../components/crud/noResult/NoResult";
import PageActions from "../../../../../components/crud/pageActions/PageActions";
import PageHeader from "../../../../../components/crud/pageHeader/PageHeader";
import PageResult from "../../../../../components/crud/pageResult/PageResult";
import StatusTab from "../../../../../components/crud/statusTab/StatusTab";
import DataSidebar from "../../../../../components/dataSidebar/DataSidebar";
import DataTable from "../../../../../components/dataTable/DataTable";
import EmployeesList from "../../../../../components/employees/employeesList/EmployeesList";
import LoadingIcon from "../../../../../components/loadingIcon/LoadingIcon";
import ActionModal from "../../../../../components/modals/actionModal/ActionModal";
import SearchFilterBar from "../../../../../components/searchFilterBar/SearchFilterBar";
import { useAccessControl } from "../../../../../context/AccessControlContext";
import { useTheme } from "../../../../../context/ThemeContext";
import { fetchEmployees } from "../../../../../features/hr/employees/private/api/employeesService";
import { buildStatusTabs } from "../../../../../functions/statusTabs";
import { getEmployeeStatusTabsConfig } from "../../../../../functions/employeeStatusTabsConfig";
import {
  EMPLOYEE_STATUS_TRANSITIONS,
  FINALIZE_DEPARTURE_STATUS_IDS,
} from "../../../../../features/hr/employees/private/employeeStatusTransitions";
import { useEmployeeById } from "../../../../../features/hr/employees/private/hooks/useEmployeeById";
import useEmployeeMutations from "../../../../../features/hr/employees/private/hooks/useEmployeeMutations";
import { useEmployeesMetadata } from "../../../../../features/hr/employees/private/hooks/useEmployeesMetadata";
import usePaginatedQuery from "../../../../../hooks/usePaginatedQuery";
import "./EmployeeManagement.scss";
import { getEmployeesFilterConfig } from "./filterConfig";
import EmployeeLifecycleCaseSummary from "./item/EmployeeLifecycleCaseSummary";
import EmployeeSidebar from "./item/EmployeeSidebar";
import { getEmployeesLayoutConfig } from "./layoutConfig";
import { employeesTableConfig } from "./tableConfig";

/**
 * HR Employee Management Page
 * This is private HR / employment data
 * Server-side filtering and pagination
 */
export default function EmployeeManagement() {
  const navigate = useNavigate();
  const { employeeId } = useParams();
  const [searchParams] = useSearchParams();

  const { darkMode } = useTheme();
  const { departmentSub, isSuperAdmin } = useAccessControl();
  const [layout, setLayout] = useState(2); // 1: Card, 2: Table
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRowId, setSelectedRowId] = useState(null);
  const [pendingDeleteRow, setPendingDeleteRow] = useState(null);
  const [modalType, setModalType] = useState(null); // "save" | "reject"
  const [pendingSaveRow, setPendingSaveRow] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedRows, setSelectedRows] = useState([]);
  // Table view's single currently-editing row (exclusive -- only one row
  // editable at a time, see DataTable.jsx). Controlled here (rather than
  // left as DataTable's internal state) so a successful save can clear it
  // alongside pendingSaveRow/modalType in handleConfirmAction below.
  const [editingRowId, setEditingRowId] = useState(null);
  // Guided status-transition modal state -- separate from the plain
  // save/delete ActionModal above (different fields/confirm behavior, see
  // docs/EMPLOYEE-LIFECYCLE-CHECKLIST-ARCHITECTURE.md Part 2).
  const [pendingTransition, setPendingTransition] = useState(null); // { key, employeeId } | null
  const canManageTransitions = departmentSub === "HR" || isSuperAdmin;

  // ==============
  // HOOKS
  // ==============

  // MAIN PAGINATED DATA AND TABLE
  const {
    data: employees,
    totalCount,
    page,
    totalPages,
    search,
    filters,
    sorting,
    activeFilters,
    hasActiveFilters,
    setPage,
    setSearch,
    setFilters,
    setSorting,
    resetParams,
    isLoading: employeesLoading,
    isFetching: employeesFetching,
    error: employeesError,
  } = usePaginatedQuery({
    queryKey: "employees",
    queryFn: fetchEmployees,
    pageSize: 50,
    defaultSortBy: "full_name",
  });

  // ==============
  // METADATA
  // ==============

  const {
    managers,
    profiles,
    departments,
    nationalities,
    identificationTypes,
    employmentTypes,
    terminationReasons,
    employmentStatuses,
    workLocations,
    isLoading: metadataLoading,
    isFetching: metadataFetching,
    error: metadataError,
  } = useEmployeesMetadata();

  const {
    createEmployee,
    updateEmployee,
    deleteEmployee,
    bulkDeleteEmployees,
    bulkUpdateEmployees,
    applyEmployeeStatusTransition,
    creating,
    updating,
    deleting,
    bulkDeleting,
    bulkUpdating,
    applyingStatusTransition,
  } = useEmployeeMutations();

  // ==============
  // CONFIG
  // ==============
  const layoutOptions = getEmployeesLayoutConfig();
  const columns = employeesTableConfig({
    managers,
    profiles,
    departments,
    nationalities,
    identificationTypes,
    employmentTypes,
    terminationReasons,
    employmentStatuses,
    workLocations,
    isSuperAdmin,
  });
  const filterConfig = getEmployeesFilterConfig({
    managers,
    departments,
    nationalities,
    identificationTypes,
    employmentTypes,
    terminationReasons,
    employmentStatuses,
    workLocations,
  });
  const statusTabs = buildStatusTabs({
    searchParams,
    ...getEmployeeStatusTabsConfig(),
  });

  // ==============
  // DATA LOADING
  // ==============
  const isLoading = employeesLoading || metadataLoading;
  const error = employeesError || metadataError;
  const isFetching = employeesFetching || metadataFetching;
  const isSaving = creating || updating || bulkUpdating;
  const hasData = employees.length > 0;

  // ==============
  // TOGGLE ROW SELECTION
  // ==============
  function toggleRowSelection(data) {
    setSelectedRows((prev) => {
      const exists = prev.find((r) => r.id === data.id);

      if (exists) {
        return prev.filter((r) => r.id !== data.id);
      }

      return [...prev, data];
    });
  }

  // ==============
  // SIDEBAR OPEN & CLOSE -- URL-driven (:employeeId), same pattern as
  // LeadsManagement.jsx/SapClients.jsx: the URL is the source of truth, not
  // local state, so a link straight to /app/hr/employees/list/<id> (e.g.
  // from a notification) opens that employee's sidebar directly.
  // ==============
  const isCreating = employeeId === "new";

  const { data: fetchedEmployee } = useEmployeeById(employeeId);

  // Selected row: check the already-loaded page first (instant UI), else
  // fall back to the direct by-id fetch (for a deep link to a row not on
  // the current page).
  const selectedRow = useMemo(() => {
    if (employeeId === "new") return {};
    if (!employeeId) return null;

    const employeeInList = employees?.find((e) => e.id === employeeId);
    if (employeeInList) return employeeInList;

    return fetchedEmployee || null;
  }, [employeeId, employees, fetchedEmployee]);

  const sidebarOpen = !!selectedRow;

  useEffect(() => {
    setIsEditing(isCreating);
  }, [isCreating]);

  function handleOpenSidebar(data) {
    navigate(`${data.id}?${searchParams.toString()}`);
  }

  function handleCloseSidebar() {
    setIsEditing(false);
    navigate(`/app/hr/employees/list?${searchParams.toString()}`);
  }

  // ==============
  // SAVE + UPDATE
  // ==============
  function handleRequestSave(data) {
    setPendingSaveRow(data);
    setModalType("save");
    setModalOpen(true);
  }

  // Table view's row-level edit -- DataTable never mutates directly, it
  // only asks the host page to confirm+persist (same ActionModal/mutation
  // path the sidebar already uses), so this just reshapes the row-edit
  // payload into the same {id, ...fields} shape handleRequestSave/
  // handleConfirmAction already handle for the sidebar.
  function handleRequestRowSave({ row, changedFields }) {
    handleRequestSave({ id: row.id, ...changedFields });
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

  function handleBulkDelete() {
    setPendingDeleteRow(selectedRows);
    setModalType("bulk-delete");
    setModalOpen(true);
  }

  // ==============
  // CONFIRM ACTION DELETE / SAVE / UPDATE
  // ==============
  async function handleConfirmAction() {
    try {
      if (modalType === "delete") {
        await deleteEmployee(selectedRowId);
      }

      if (modalType === "bulk-delete") {
        await bulkDeleteEmployees(selectedRows.map((r) => r.id));

        setSelectedRows([]);
      }

      if (modalType === "save") {
        const data = pendingSaveRow;

        if (data.id) {
          await updateEmployee(data);
        } else {
          await createEmployee(data);
        }
      }

      setModalOpen(false);
      // A row-edit-originated save has no sidebar open -- guard so it
      // doesn't push a redundant navigation entry to the same list URL.
      if (sidebarOpen) handleCloseSidebar();
      setPendingSaveRow(null);
      setModalType(null);
      setEditingRowId(null);
    } catch (err) {
      console.error(err);
    }
  }

  // ==============
  // GUIDED STATUS TRANSITIONS -- see
  // docs/EMPLOYEE-LIFECYCLE-CHECKLIST-ARCHITECTURE.md Part 2. Separate
  // ActionModal instance from the save/delete one above -- different
  // dynamic-fields schema and confirm behavior, not a status-only confirm.
  // ==============
  function handleRequestTransition(transitionKey) {
    setPendingTransition({ key: transitionKey, employeeId: selectedRow.id });
  }

  function handleCancelTransition() {
    setPendingTransition(null);
  }

  function getTransitionModalFields(transitionKey) {
    const transition = EMPLOYEE_STATUS_TRANSITIONS[transitionKey];
    if (!transition) return [];

    const fields = [];

    if (transition.collectsTerminationReason) {
      fields.push({
        name: "termination_reason_id",
        type: "select",
        // "Reason for Departure", not "Termination Reason" -- this field is
        // shared by BEGIN_OFFBOARDING and IMMEDIATE_DEPARTURE, neither of
        // which assumes the outcome is actually a termination (it could
        // resolve to Resigned/Retired via Finalize Departure or the Final
        // Status picker below).
        label: "Reason for Departure",
        required: true,
        options: terminationReasons.map((t) => ({
          label: t.name,
          value: t.id,
        })),
      });
    }

    if (transition.collectsExpectedLastDay) {
      fields.push({
        name: "expected_last_day",
        type: "date",
        label: "Expected Last Day",
        required: true,
        // Immediate Departure has no notice period, so "expected" is
        // normally today -- still editable, e.g. to backdate a walkout.
        defaultValue:
          transitionKey === "IMMEDIATE_DEPARTURE"
            ? new Date().toISOString().slice(0, 10)
            : undefined,
      });
    }

    if (transition.collectsFinalStatus) {
      fields.push({
        name: "employment_status_id",
        type: "select",
        label: "Final Status",
        required: true,
        options: employmentStatuses
          .filter((s) => FINALIZE_DEPARTURE_STATUS_IDS.includes(s.id))
          .map((s) => ({ label: s.name, value: s.id })),
      });
    }

    if (transition.collectsConfirmationDate) {
      fields.push({
        name: "confirmation_date",
        type: "date",
        label: "Confirmation Date",
        required: true,
        // An actual-event field (see check_employee_confirmation_status_
        // mismatches.sql) -- defaults to today, since HR is confirming this
        // right now, but stays editable to backdate an already-completed
        // review.
        defaultValue: new Date().toISOString().slice(0, 10),
      });
    }

    return fields;
  }

  async function handleConfirmTransition(formValues) {
    if (!pendingTransition) return;
    const transition = EMPLOYEE_STATUS_TRANSITIONS[pendingTransition.key];

    try {
      await applyEmployeeStatusTransition({
        employeeId: pendingTransition.employeeId,
        // Plain <select>/<input> values are always strings -- coerce the
        // numeric FK fields before submitting.
        employmentStatusId:
          transition.targetEmploymentStatusId ??
          parseInt(formValues.employment_status_id, 10),
        terminationReasonId: formValues.termination_reason_id
          ? parseInt(formValues.termination_reason_id, 10)
          : null,
        expectedLastDay: formValues.expected_last_day || null,
        confirmationDate: formValues.confirmation_date || null,
      });

      setPendingTransition(null);
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <>
      {/* SEARCH AND FILTER BAR -- enableDateRange's startDate/endDate maps to
          join_date (hire date) in fetchEmployees, unlocking hiresInPeriod/
          ytdHiresCount/tenureDistributionData drill-through from Employee
          Overview. */}
      <SearchFilterBar
        search={search}
        onSearchChange={setSearch}
        filters={filters}
        onFilterChange={setFilters}
        filterConfig={filterConfig}
        placeholder="Search employees..."
        enableDateRange
      />

      <PageHeader>
        {/* LAYOUT UI + ACTION BUTTONS */}
        <PageActions
          layout={layout}
          setLayout={setLayout}
          options={layoutOptions}
          actionButtons={[
            {
              icon: PlusCircleIcon,
              name: "Add Employee",
              style: "button buttonType5 greenFill buttonFull textXXS",
              onClick: () => {
                navigate(`new?${searchParams.toString()}`);
              },
            },
            // {
            //   name: "Select All",
            //   icon: CheckIcon,
            //   onClick: () => setSelectedRows(employees),
            // },
            // {
            //   name: "Unselect All",
            //   icon: XIcon,
            //   onClick: () => setSelectedRows([]),
            //   disabled: selectedRows.length === 0,
            // },
            // {
            //   name:
            //     selectedRows.length !== 0 && `(${selectedRows.length} rows)`,
            //   icon: TrashIcon,
            //   style: "button buttonType5 rejection textXXS",
            //   onClick: handleBulkDelete,
            //   disabled: selectedRows.length === 0,
            // },
          ]}
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

      {/* STATUS TABS -- statusBucket (Active/Terminated/Inactive) as the
          primary enum, plus confirmation/contract/lifecycle-case quick
          filters as extraTabs (see functions/employeeStatusTabsConfig.js).
          Same buildStatusTabs()/StatusTab pattern as Attendance Management's
          List page. */}
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

      {/* RESULT NUMBER + NEXT AND PREVIOUS BUTTONS */}
      <PageResult
        data={employees}
        totalCount={totalCount}
        page={page}
        setPage={setPage}
        totalPages={totalPages}
        error={error}
      />

      {/* TABLE DISPLAY UI */}
      <div className="cardWrapperScroll">
        {isLoading || isFetching ? (
          <CardLayout style="cardLayoutFlexFull">
            <LoadingIcon />
          </CardLayout>
        ) : !hasData ? (
          <NoResult />
        ) : error ? (
          <NoResult title="Error loading results" />
        ) : layout === 1 ? (
          // TABLE LAYOUT
          <DataTable
            data={employees}
            columns={columns}
            rowKey="id"
            onRowClick={handleOpenSidebar}
            sorting={sorting}
            onSortingChange={setSorting}
            manualSorting
            editableRows
            showCompleteness
            onRequestRowSave={handleRequestRowSave}
            editingRowId={editingRowId}
            onEditingRowIdChange={setEditingRowId}
          />
        ) : (
          // LIST LAYOUT
          <CardLayout style="cardLayout1 cardGapSmall">
            {employees.map((employee) => (
              <EmployeesList
                key={employee.id}
                employee={employee}
                onClick={() => handleOpenSidebar(employee)}
                saving={isSaving}
                deleting={deleting}
                setIsEditing={() => setIsEditing(true)}
                selected={selectedRows.some((r) => r.id === employee.id)}
                onSelect={() => toggleRowSelection(employee)}
              />
            ))}
          </CardLayout>
        )}
      </div>

      {/* DATA SIDEBAR */}
      <AnimatePresence>
        {sidebarOpen && (
          <DataSidebar
            title={selectedRow?.id ? "Edit Employee" : "Add Employee"}
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
            isEditing={isEditing}
            onCancel={() => setIsEditing(false)}
          >
            {/* PICTURE */}
            {selectedRow?.id && !isEditing && (
              <>
                <EmployeeSidebar
                  selectedRow={selectedRow}
                  isEditing={isEditing}
                  setIsEditing={setIsEditing}
                  canManageTransitions={canManageTransitions}
                  onRequestTransition={handleRequestTransition}
                />
                {/* Onboarding/offboarding checklist status -- see
                    docs/EMPLOYEE-LIFECYCLE-CHECKLIST-ARCHITECTURE.md's
                    "Employee Management & IT Asset Management integration". */}
                <EmployeeLifecycleCaseSummary employeeId={selectedRow.id} />
              </>
            )}
          </DataSidebar>
        )}
      </AnimatePresence>

      {/* ACTION MODAL */}
      <ActionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalType === "save" ? "Save Employee" : "Delete Employee"}
        description={
          modalType === "save"
            ? "Are you sure you want to save these changes?"
            : "Are you sure you want to delete this employee?"
        }
        confirmText={modalType === "save" ? "Save" : "Delete"}
        loading={
          modalType === "save"
            ? isSaving
            : modalType === "bulk-delete"
              ? bulkDeleting
              : deleting
        }
        onConfirm={handleConfirmAction}
        modalType={modalType}
      />

      {/* GUIDED STATUS TRANSITION MODAL -- see
          docs/EMPLOYEE-LIFECYCLE-CHECKLIST-ARCHITECTURE.md Part 2. */}
      <ActionModal
        open={!!pendingTransition}
        onClose={handleCancelTransition}
        title={
          pendingTransition
            ? EMPLOYEE_STATUS_TRANSITIONS[pendingTransition.key].modalTitle
            : "Confirm"
        }
        description={
          pendingTransition
            ? EMPLOYEE_STATUS_TRANSITIONS[pendingTransition.key]
                .modalDescription
            : ""
        }
        confirmText={
          pendingTransition
            ? EMPLOYEE_STATUS_TRANSITIONS[pendingTransition.key].label
            : "Confirm"
        }
        fields={
          pendingTransition
            ? getTransitionModalFields(pendingTransition.key)
            : []
        }
        loading={applyingStatusTransition}
        onConfirm={handleConfirmTransition}
        modalType={
          pendingTransition?.key === "IMMEDIATE_DEPARTURE"
            ? "delete"
            : "approve"
        }
      />
    </>
  );
}
