// pages/user/hr/employees/Employees.jsx
import "./EmployeeManagement.scss";
import {
  PencilSimpleLineIcon,
  PlusCircleIcon,
  UsersFourIcon,
} from "@phosphor-icons/react";
import CardLayout from "../../../../components/cardLayout/CardLayout";
import LoadingIcon from "../../../../components/loadingIcon/LoadingIcon";
import { useTheme } from "../../../../context/ThemeContext";
import { useEffect, useState } from "react";
import CardWrapper from "../../../../components/cardWrapper/CardWrapper";
import Breadcrumbs from "../../../../components/breadcrumbs/Breadcrumbs";
import SearchFilterBar from "../../../../components/searchFliterBar/SearchFilterBar";
import DataTable from "../../../../components/dataTable/DataTable";
import DataSidebar from "../../../../components/dataSidebar/DataSidebar";
import { AnimatePresence } from "framer-motion";
import useDepartments from "../../../../hooks/useDepartments";
import EmployeesList from "../../../../components/employeesList/EmployeesList";
import ActiveFiltersBar from "../../../../components/crud/activeFiltersBar/ActiveFiltersBar";
import PageHeader from "../../../../components/crud/pageHeader/PageHeader";
import useEmployees from "../../../../hooks/useEmployees";
import useEmploymentStatus from "../../../../hooks/useEmploymentStatus";
import useNationalities from "../../../../hooks/useNationalities";
import useIdentificationTypes from "../../../../hooks/useIdentificationTypes";
import useEmploymentTypes from "../../../../hooks/useEmploymentTypes";
import useTerminationReasons from "../../../../hooks/useTerminationReasons";
import { employeesTableConfig } from "./tableConfig";
import useProfiles from "../../../../hooks/useProfiles";
import { getEmployeesFilterConfig } from "./filterConfig";
import useEmployeeMutations from "../../../../hooks/useEmployeeMutations";
import { useSearchParams } from "react-router-dom";
import ActionModal from "../../../../components/modals/actionModal/ActionModal";
import NoResult from "../../../../components/noResult/NoResult";
import PageResult from "../../../../components/crud/pageResult/PageResult";
import OverviewCards from "../../../../components/crud/overviewCards/OverviewCards";
import { getEmployeesOverviewConfig } from "./overviewConfig";
import PageLayout from "../../../../components/crud/pageLayout/PageLayout";
import { getEmployeesLayoutConfig } from "./layoutConfig";

/**
 * HR Employee Management Page
 * This is private HR / employment data
 * Server-side filtering and pagination
 */
export default function EmployeeManagement() {
  const { darkMode } = useTheme();
  const [layout, setLayout] = useState(2); // 1: Card, 2: Table
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [ready, setReady] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [pendingDeleteEmployee, setPendingDeleteEmployee] = useState(null);

  // ==============
  // HOOKS
  // ==============
  const {
    employees,
    setEmployees,
    loading: employeesLoading,
    error,
    totalCount,
    page,
    setPage,
    search,
    setSearch,
    filters,
    setFilters,
    refetch,
    summary,
  } = useEmployees({ ready });
  const { profiles, loading: profilesLoading } = useProfiles();
  const { departments, loading: departmentsLoading } = useDepartments();
  const { nationalities, loading: nationalitiesLoading } = useNationalities();
  const { identificationTypes, loading: identificationTypesLoading } =
    useIdentificationTypes();
  const { employmentTypes, loading: employmentTypesLoading } =
    useEmploymentTypes();
  const { terminationReasons, loading: terminationReasonsLoading } =
    useTerminationReasons();
  const { statuses: employmentStatuses, loading: employmentStatusesLoading } =
    useEmploymentStatus();
  const { createEmployee, updateEmployee, deleteEmployee, saving, deleting } =
    useEmployeeMutations();
  const overviewItems = getEmployeesOverviewConfig(summary);
  const layoutOptions = getEmployeesLayoutConfig();

  // ==============
  // DATA LOADING
  // ==============
  const isLoading =
    employeesLoading ||
    profilesLoading ||
    departmentsLoading ||
    nationalitiesLoading ||
    identificationTypesLoading ||
    employmentTypesLoading ||
    terminationReasonsLoading ||
    employmentStatusesLoading;

  const hasData = employees.length > 0;

  // ==============
  // TABLE CONFIG
  // ==============
  const columns = employeesTableConfig({
    employees,
    profiles,
    departments,
    nationalities,
    identificationTypes,
    employmentTypes,
    terminationReasons,
    employmentStatuses,
  });

  // ==============
  // FILTER CONFIG
  // ==============
  const filterConfig = getEmployeesFilterConfig({
    departments,
    nationalities,
    identificationTypes,
    employmentTypes,
    terminationReasons,
    employmentStatuses,
  });

  // ==============
  // ACTIVE FILTERS
  // ==============
  const activeFilters = Object.entries(filters).filter(
    ([_, value]) => value && value !== "",
  );
  const hasActiveFilters = search || activeFilters.length > 0;

  // parent component or hook
  const rowsPerPage = 20;
  const totalPages = Math.ceil(totalCount / rowsPerPage);

  // ==============
  // Search & Filter in URL (On Load)
  // ==============
  useEffect(() => {
    const pageParam = Number(searchParams.get("page")) || 1;
    const searchParam = searchParams.get("search") || "";

    const newFilters = {};
    for (const [key, value] of searchParams.entries()) {
      if (key !== "page" && key !== "search") {
        newFilters[key] = value;
      }
    }

    setPage(pageParam);
    setSearch(searchParam);
    setFilters(newFilters);

    // 🔥 IMPORTANT: signal that URL state is now ready
    setReady(true);
  }, []);

  // ==============
  // Search & Filter in URL (On Change)
  // ==============
  useEffect(() => {
    const params = {
      page,
      search,
      ...filters,
    };

    setSearchParams(params);
  }, [page, search, filters]);

  useEffect(() => {
    setPage(1);
  }, [search, filters]);

  // ==============
  // SIDEBAR OPEN & CLOSE
  // ==============
  function handleOpenSidebar(employee) {
    setSelectedEmployee(employee);
    setSidebarOpen(true);
  }

  function handleCloseSidebar() {
    setSidebarOpen(false);
    setSelectedEmployee(null);
  }

  // ==============
  // SAVE + UPDATE
  // ==============
  async function handleSaveSidebar(data) {
    if (modalOpen) return;

    try {
      if (data.id) {
        // UPDATE
        await updateEmployee(data);
      } else {
        // CREATE
        await createEmployee(data);
      }

      await refetch({ page, search, filters });
      setSidebarOpen(false);
      setSelectedEmployee(null);
    } catch (err) {
      console.error(err);
    }
  }

  // ==============
  // DELETE
  // ==============
  function handleRequestDelete(employee) {
    setSidebarOpen(true);
    setPendingDeleteEmployee(employee);
    setSelectedEmployeeId(employee.id);
    setModalOpen(true);
  }

  async function handleConfirmDelete() {
    try {
      await deleteEmployee(selectedEmployeeId);

      await refetch({ page, search, filters });

      setModalOpen(false);
      setSidebarOpen(false); // 👈 ONLY HERE
      setSelectedEmployee(null);
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <>
      <section className={darkMode ? "sectionDark" : "sectionLight"}>
        <div className="sectionWrapper">
          <div className="sectionContent">
            <Breadcrumbs icon={UsersFourIcon} current="Employee Management" />

            <CardWrapper>
              {/* OVERVIEW */}
              <OverviewCards items={overviewItems} />

              {/* SEARCH AND FILTER BAR */}
              <SearchFilterBar
                search={search}
                onSearchChange={setSearch}
                filters={filters}
                onFilterChange={setFilters}
                filterConfig={filterConfig}
                placeholder="Search employees..."
              />

              {/* LAYOUT UI + ADD */}
              <PageHeader>
                <PageLayout
                  layout={layout}
                  setLayout={setLayout}
                  options={layoutOptions}
                  addButton={{
                    name: "Add Employee",
                    icon: PlusCircleIcon,
                    onClick: () => {
                      setSelectedEmployee({});
                      setSidebarOpen(true);
                    },
                  }}
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
                {isLoading ? (
                  <CardLayout style="cardLayoutFlexFull">
                    <LoadingIcon />
                  </CardLayout>
                ) : !hasData ? (
                  <NoResult />
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
                  <CardLayout style="cardLayout1 cardPadding">
                    {employees.map((employee) => (
                      <EmployeesList
                        key={employee.id}
                        employee={employee}
                        onClick={() => handleOpenSidebar(employee)}
                        saving={saving}
                        deleting={deleting}
                      />
                    ))}
                  </CardLayout>
                )}
              </div>
            </CardWrapper>
          </div>
        </div>
      </section>

      {/* DATA SIDEBAR */}
      <AnimatePresence>
        {sidebarOpen && (
          <DataSidebar
            title={selectedEmployee?.id ? "Edit Employee" : "Add Employee"}
            icon={PencilSimpleLineIcon}
            open={sidebarOpen}
            onClose={handleCloseSidebar}
            rowData={selectedEmployee}
            columns={columns}
            onSave={handleSaveSidebar}
            onDelete={handleRequestDelete}
            saving={saving}
            deleting={deleting}
            creating={!selectedEmployee?.id}
          >
            <div className="employeeCardPhotoSidebar">
              <img
                src={
                  selectedEmployee.profile?.avatar_url ||
                  "/profilePhoto/default.webp"
                }
                alt={selectedEmployee.full_name}
              />
            </div>
          </DataSidebar>
        )}
      </AnimatePresence>

      <ActionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Delete Employee"
        description="Are you sure you want to delete this employee?"
        confirmText="Delete"
        loading={deleting}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
