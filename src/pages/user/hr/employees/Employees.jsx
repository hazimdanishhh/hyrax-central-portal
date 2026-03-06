// pages/user/hr/employees/Employees.jsx
import "./Employees.scss";
import {
  CaretLeftIcon,
  CaretRightIcon,
  PencilSimpleLineIcon,
  PlusCircleIcon,
  SquaresFourIcon,
  TableIcon,
  UserCircleCheckIcon,
  UserCircleDashedIcon,
  UserCirclePlusIcon,
  UserFocusIcon,
  UsersFourIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";
import CardLayout from "../../../../components/cardLayout/CardLayout";
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

export default function Employees() {
  const { darkMode } = useTheme();
  const [layout, setLayout] = useState(2); // 1: Card, 2: Table
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ==============
  // Hooks for employee filter data
  // ==============
  const {
    employees,
    setEmployees,
    loading: employeesLoading,
    error,
    refetch,
  } = useEmployees();
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

  // ==============
  // Table Config
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
  // Filter Config
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
  // Search + Filter logic for IT employees
  // ==============
  const {
    search,
    setSearch,
    filters,
    setFilters,
    data: filteredEmployees,
  } = useSearchFilter({
    data: employees, // `employees` is Employee Table data
    searchFields: ["employee_id", "full_name"], // searchable fields
    filterMap: {
      department: (employee, value) => employee.department?.name === value,
      nationality: (employee, value) => employee.nationality?.name === value,
      identificationType: (employee, value) =>
        employee.identification_type?.name === value,
      employmentType: (employee, value) =>
        employee.employment_type?.name === value,
      terminationReason: (employee, value) =>
        employee.termination_reason?.name === value,
      employmentStatus: (employee, value) =>
        employee.employment_status?.name === value,
      maritalStatus: (employee, value) => employee.marital_status === value,
    },
  });

  // =====================
  // OVERVIEW METRICS
  // =====================
  const totalEmployees = employees.length;

  const activeEmployees = employees.filter(
    (e) => e.employment_status?.name === "Active",
  ).length;

  const inactiveStatuses = [
    "Terminated",
    "Resigned",
    "Retired",
    "Inactive",
    "Suspended",
    "Sabbatical",
    "On Leave",
  ];

  const inactiveEmployees = employees.filter((e) =>
    inactiveStatuses.includes(e.employment_status?.name),
  ).length;

  const probationEmployees = employees.filter(
    (e) => e.employment_status?.name === "Probation",
  ).length;

  const internEmployees = employees.filter(
    (e) => e.employment_status?.name === "Intern",
  ).length;

  const newHires = employees.filter((e) => {
    if (!e.join_date) return false;

    const joinDate = new Date(e.join_date);
    const now = new Date();
    const diffDays = (now - joinDate) / (1000 * 60 * 60 * 24);

    return diffDays <= 30;
  }).length;

  const utilizationRate =
    totalEmployees > 0
      ? Math.round((activeEmployees / totalEmployees) * 100)
      : 0;

  const totalDepartments = departments.length;

  // ==============
  // ACTIVE FILTERS
  // ==============
  const activeFilters = Object.entries(filters).filter(
    ([_, value]) => value && value !== "",
  );
  const hasActiveFilters = search || activeFilters.length > 0;

  // parent component or hook
  const rowsPerPage = 20;
  const totalPages = Math.ceil(filteredEmployees.length / rowsPerPage);

  // slice data for current page
  const [currentPage, setCurrentPage] = useState(1);
  const paginatedData = filteredEmployees.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage,
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [filteredEmployees]);

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

  console.log(selectedEmployee);

  // ==============
  // SAVE + UPDATE
  // ==============
  // async function handleSaveSidebar(data) {
  //   try {
  //     let savedRow;

  //     if (data.id) {
  //       // UPDATE
  //       // const updatedRows = await updateEmployee(data);
  //       // savedRow = updatedRows?.[0];

  //       savedRow = await updateEmployee(data);
  //       setEmployees((prev) =>
  //         prev.map((a) => (a.id === savedRow.id ? savedRow : a)),
  //       );
  //     } else {
  //       // CREATE
  //       savedRow = await createEmployee(data);
  //       setEmployees((prev) => [savedRow, ...prev]); // add to top
  //     }

  //     setSidebarOpen(false);
  //     setSelectedEmployee(null);
  //   } catch (err) {
  //     console.error(err);
  //   }
  // }

  async function handleSaveSidebar(data) {
    try {
      if (data.id) {
        // UPDATE
        await updateEmployee(data);
      } else {
        // CREATE
        await createEmployee(data);
      }

      await refetch();
      setSidebarOpen(false);
      setSelectedEmployee(null);
    } catch (err) {
      console.error(err);
    }
  }

  // ==============
  // DELETE
  // ==============
  async function handleDeleteSidebar(employee) {
    try {
      await deleteEmployee(employee.id);
      await refetch();
      setSidebarOpen(false);
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
              <CardLayout style="cardLayout4">
                <CardLayout style="generalCard">
                  <CardLayout style="cardLayoutFlex cardGapMedium cardLayoutNoPadding">
                    <UsersFourIcon />
                    <h3 className="textRegular textS">Total Employees</h3>
                  </CardLayout>
                  <h2 className="textXL">{totalEmployees}</h2>
                </CardLayout>

                <CardLayout style="generalCard greenCard">
                  <CardLayout style="cardLayoutFlex cardGapMedium cardLayoutNoPadding">
                    <UserCircleCheckIcon />
                    <h3 className="textRegular textS">Active Employees</h3>
                  </CardLayout>
                  <h2 className="textXL">{activeEmployees}</h2>
                </CardLayout>

                <CardLayout style="generalCard redCard">
                  <CardLayout style="cardLayoutFlex cardGapMedium cardLayoutNoPadding">
                    <UserCircleDashedIcon />
                    <h3 className="textRegular textS">Inactive Employees</h3>
                  </CardLayout>
                  <h2 className="textXL">{inactiveEmployees}</h2>
                </CardLayout>

                <CardLayout style="generalCard">
                  <CardLayout style="cardLayoutFlex cardGapMedium cardLayoutNoPadding">
                    <UserCirclePlusIcon />
                    <h3 className="textRegular textS">New Hires</h3>
                  </CardLayout>
                  <h2 className="textXL">{newHires}</h2>
                </CardLayout>

                <CardLayout style="generalCard">
                  <CardLayout style="cardLayoutFlex cardGapMedium cardLayoutNoPadding">
                    <UsersThreeIcon />
                    <h3 className="textRegular textS">Total Departments</h3>
                  </CardLayout>
                  <h2 className="textXL">{totalDepartments}</h2>
                </CardLayout>

                <CardLayout style="generalCard">
                  <CardLayout style="cardLayoutFlex cardGapMedium cardLayoutNoPadding">
                    <UserFocusIcon />
                    <h3 className="textRegular textS">On Probation</h3>
                  </CardLayout>
                  <h2 className="textXL">{probationEmployees}</h2>
                </CardLayout>

                <CardLayout style="generalCard">
                  <CardLayout style="cardLayoutFlex cardGapMedium cardLayoutNoPadding">
                    <UserFocusIcon />
                    <h3 className="textRegular textS">Interns</h3>
                  </CardLayout>
                  <h2 className="textXL">{internEmployees}</h2>
                </CardLayout>
              </CardLayout>

              {/* SEARCH AND FILTER BAR */}
              <PageHeader>
                <SearchFilterBar
                  search={search}
                  onSearchChange={setSearch}
                  filters={filters}
                  onFilterChange={setFilters}
                  filterConfig={filterConfig}
                  placeholder="Search employees..."
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
                <Button
                  name="Add Employee"
                  icon2={PlusCircleIcon}
                  style="button buttonType3 textXXS"
                  onClick={() => {
                    setSelectedEmployee({}); // empty object = new mode
                    setSidebarOpen(true);
                  }}
                />
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
              {employeesLoading ||
              profilesLoading ||
              departmentsLoading ||
              nationalitiesLoading ||
              identificationTypesLoading ||
              employmentTypesLoading ||
              terminationReasonsLoading ||
              employmentStatusesLoading ? (
                <LoadingIcon />
              ) : layout === 1 ? (
                <>
                  {paginatedData.length > 0 && (
                    <CardLayout style=" cardLayoutFlexFull cardGapLarge cardLayoutEnd cardLayoutNoPadding">
                      <p className="textRegular textXXS">
                        <strong>Total Result: </strong>
                        {paginatedData.length} / {filteredEmployees.length}
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
                  )}
                  <DataTable
                    data={paginatedData}
                    columns={columns}
                    rowKey="id"
                    onRowClick={handleOpenSidebar}
                  />
                </>
              ) : (
                <>
                  {paginatedData.length > 0 && (
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
                          {paginatedData.length} / {filteredEmployees.length}
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
                  )}
                  <div className="cardWrapperScroll generalCard">
                    <CardLayout style="cardLayout1 cardPadding">
                      {paginatedData.map((employee) => (
                        <EmployeesList
                          key={employee.id}
                          employee={employee}
                          onClick={() => handleOpenSidebar(employee)}
                          saving={saving}
                          deleting={deleting}
                        />
                      ))}
                    </CardLayout>
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
            title={selectedEmployee?.id ? "Edit Employee" : "Add Employee"}
            icon={PencilSimpleLineIcon}
            open={sidebarOpen}
            onClose={handleCloseSidebar}
            rowData={selectedEmployee}
            columns={columns}
            onSave={handleSaveSidebar}
            onDelete={handleDeleteSidebar}
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
    </>
  );
}
