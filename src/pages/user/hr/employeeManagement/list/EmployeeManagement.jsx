// pages/user/hr/employees/Employees.jsx
import "./EmployeeManagement.scss";
import {
  CheckIcon,
  PencilSimpleLineIcon,
  PlusCircleIcon,
  TrashIcon,
  UsersFourIcon,
  XIcon,
} from "@phosphor-icons/react";
import CardLayout from "../../../../../components/cardLayout/CardLayout";
import LoadingIcon from "../../../../../components/loadingIcon/LoadingIcon";
import { useTheme } from "../../../../../context/ThemeContext";
import { useEffect, useState } from "react";
import CardWrapper from "../../../../../components/cardWrapper/CardWrapper";
import Breadcrumbs from "../../../../../components/breadcrumbs/Breadcrumbs";
import SearchFilterBar from "../../../../../components/searchFilterBar/SearchFilterBar";
import DataTable from "../../../../../components/dataTable/DataTable";
import DataSidebar from "../../../../../components/dataSidebar/DataSidebar";
import { AnimatePresence } from "framer-motion";
import EmployeesList from "../../../../../components/employees/employeesList/EmployeesList";
import ActiveFiltersBar from "../../../../../components/crud/activeFiltersBar/ActiveFiltersBar";
import PageHeader from "../../../../../components/crud/pageHeader/PageHeader";
import { employeesTableConfig } from "./tableConfig";
import { getEmployeesFilterConfig } from "./filterConfig";
import { useSearchParams } from "react-router-dom";
import ActionModal from "../../../../../components/modals/actionModal/ActionModal";
import PageResult from "../../../../../components/crud/pageResult/PageResult";
import OverviewCards from "../../../../../components/crud/overviewCards/OverviewCards";
import { getEmployeesOverviewConfig } from "../overview/overviewConfig";
import PageLayout from "../../../../../components/crud/pageLayout/PageLayout";
import { getEmployeesLayoutConfig } from "./layoutConfig";
import usePaginatedQuery from "../../../../../hooks/usePaginatedQuery";
import { getEmployeesSortConfig } from "./sortConfig";
import SortBar from "../../../../../components/crud/sortBar/SortBar";
import NoResult from "../../../../../components/crud/noResult/NoResult";
import ChartCard from "../../../../../components/chartCard/ChartCard";
import StackedBarRenderer from "../../../../../components/chartCard/StackedBarRenderer";
import PieChartRenderer from "../../../../../components/chartCard/PieChartRenderer";
import {
  BLUE_COLOR,
  CONDITION_COLORS,
  EMPLOYMENT_TYPE_COLORS,
  GREEN_COLOR,
  STATUS_COLORS,
  UTILIZATION_COLORS,
} from "../../../../../components/chartCard/chartColors";
import BarChartRenderer from "../../../../../components/chartCard/BarChartRenderer";
import { fetchEmployees } from "../../../../../features/hr/employees/private/api/employeesService";
import { useEmployeesMetadata } from "../../../../../features/hr/employees/private/hooks/useEmployeesMetadata";
import useEmployeeMutations from "../../../../../features/hr/employees/private/hooks/useEmployeeMutations";
import EmployeeSidebar from "./item/EmployeeSidebar";
import PageActions from "../../../../../components/crud/pageActions/PageActions";

/**
 * HR Employee Management Page
 * This is private HR / employment data
 * Server-side filtering and pagination
 */
export default function EmployeeManagement() {
  const { darkMode } = useTheme();
  const [layout, setLayout] = useState(2); // 1: Card, 2: Table
  const [selectedRow, setSelectedRow] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRowId, setSelectedRowId] = useState(null);
  const [pendingDeleteRow, setPendingDeleteRow] = useState(null);
  const [modalType, setModalType] = useState(null); // "save" | "reject"
  const [pendingSaveRow, setPendingSaveRow] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedRows, setSelectedRows] = useState([]);

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
    isLoading: employeesLoading,
    isFetching: employeesFetching,
    error: employeesError,
  } = usePaginatedQuery({
    queryKey: "employees",
    queryFn: fetchEmployees,
    pageSize: 20,
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
    creating,
    updating,
    deleting,
    bulkDeleting,
    bulkUpdating,
  } = useEmployeeMutations();

  // ==============
  // CONFIG
  // ==============
  const layoutOptions = getEmployeesLayoutConfig();
  const sortOptions = getEmployeesSortConfig();
  const columns = employeesTableConfig({
    managers,
    profiles,
    departments,
    nationalities,
    identificationTypes,
    employmentTypes,
    terminationReasons,
    employmentStatuses,
  });
  const filterConfig = getEmployeesFilterConfig({
    managers,
    departments,
    nationalities,
    identificationTypes,
    employmentTypes,
    terminationReasons,
    employmentStatuses,
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
  // SIDEBAR OPEN & CLOSE
  // ==============
  function handleOpenSidebar(data) {
    setSelectedRow(data);
    setSidebarOpen(true);
  }

  function handleCloseSidebar() {
    setSidebarOpen(false);
    setSelectedRow(null);
    setIsEditing(false);
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
        placeholder="Search employees..."
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
              onClick: () => {
                setSelectedRow({});
                setSidebarOpen(true);
                setIsEditing(true);
              },
            },
            {
              name: "Select All",
              icon: CheckIcon,
              onClick: () => setSelectedRows(employees),
            },
            {
              name: "Unselect All",
              icon: XIcon,
              onClick: () => setSelectedRows([]),
              disabled: selectedRows.length === 0,
            },
            {
              name:
                selectedRows.length !== 0 && `(${selectedRows.length} rows)`,
              icon: TrashIcon,
              style: "button buttonType5 rejection textXXS",
              onClick: handleBulkDelete,
              disabled: selectedRows.length === 0,
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
      <div className="cardWrapperScroll generalCard">
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
          />
        ) : (
          // LIST LAYOUT
          <CardLayout style="cardLayout1 cardPaddingSmall cardGapSmall">
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
          >
            {/* PICTURE */}
            {selectedRow?.id && (
              <EmployeeSidebar
                selectedRow={selectedRow}
                isEditing={isEditing}
                setIsEditing={setIsEditing}
              />
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
    </>
  );
}
