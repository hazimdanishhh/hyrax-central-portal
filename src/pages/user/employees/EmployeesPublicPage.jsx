import { useState } from "react";
import { useTheme } from "../../../context/ThemeContext";
import LoadingIcon from "../../../components/loadingIcon/LoadingIcon";
import CardLayout from "../../../components/cardLayout/CardLayout";
import { useNavigate } from "react-router";
import EmployeeCard from "../../../components/employeeCard/EmployeeCard";
import {
  ListBulletsIcon,
  SquaresFourIcon,
  UsersFourIcon,
} from "@phosphor-icons/react";
import Breadcrumbs from "../../../components/breadcrumbs/Breadcrumbs";
import CardWrapper from "../../../components/cardWrapper/CardWrapper";
import Button from "../../../components/buttons/button/Button";
import SearchFilterBar from "../../../components/searchFilterBar/SearchFilterBar";
import PageHeader from "../../../components/crud/pageHeader/PageHeader";
import ActiveFiltersBar from "../../../components/crud/activeFiltersBar/ActiveFiltersBar";
import { useEmployee } from "../../../context/EmployeeContext";
import usePaginatedQuery from "../../../hooks/usePaginatedQuery";
import { fetchEmployeesPublic } from "../../../features/hr/employees/public/api/employeesPublic";
import { getEmployeesPublicSortConfig } from "./sortConfig";
import { getEmployeesPublicFilterConfig } from "./filterConfig";
import SortBar from "../../../components/crud/sortBar/SortBar";
import PageResult from "../../../components/crud/pageResult/PageResult";
import NoResult from "../../../components/crud/noResult/NoResult";
import EmployeesPublicList from "../../../components/employees/employeesPublicList/EmployeesPublicList";
import { useEmployeesPublicMetadata } from "../../../features/hr/employees/public/hooks/useEmployeesPublicMetadata";

export default function EmployeesPublicPage() {
  const navigate = useNavigate();
  const { darkMode } = useTheme();
  const { employee } = useEmployee();

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
    isFetching,
    error: employeesError,
  } = usePaginatedQuery({
    queryKey: "employees_public",
    queryFn: fetchEmployeesPublic,
    pageSize: 20,
    defaultSortBy: "full_name",
  });

  // ==============
  // METADATA
  // ==============
  const {
    managers,
    departments,
    nationalities,
    employmentTypes,
    isLoading: metadataLoading,
    error: metadataError,
  } = useEmployeesPublicMetadata();

  // ==============
  // CONFIG
  // ==============
  const sortOptions = getEmployeesPublicSortConfig();
  const filterConfig = getEmployeesPublicFilterConfig({
    managers,
    departments,
    nationalities,
    employmentTypes,
  });

  // ==============
  // DATA LOADING
  // ==============
  const isLoading = employeesLoading || metadataLoading;
  const error = employeesError || metadataError;
  const hasData = employees.length > 0;

  return (
    <>
      <section className={darkMode ? "sectionDark" : "sectionLight"}>
        <div className="sectionWrapper">
          <div className="sectionContent">
            <Breadcrumbs icon={UsersFourIcon} current="Employees" />

            <CardWrapper>
              <PageHeader>
                {/* SEARCH AND FILTER BAR */}
                <SearchFilterBar
                  search={search}
                  onSearchChange={setSearch}
                  filters={filters}
                  onFilterChange={setFilters}
                  filterConfig={filterConfig}
                  placeholder="Search employees..."
                />
              </PageHeader>

              <PageHeader>
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
                ) : !hasData || error ? (
                  <NoResult />
                ) : (
                  // LIST LAYOUT
                  <CardLayout style="cardLayout1 cardPaddingSmall cardGapSmall">
                    {employees.map((emp) => (
                      <EmployeesPublicList
                        key={emp.id}
                        className="employeeList generalCard"
                        onClick={() => navigate(`/app/employees/${emp.id}`)}
                        employee={emp}
                        isMyManager={emp.id === employee?.manager_id}
                      />
                    ))}
                  </CardLayout>
                )}
              </div>
            </CardWrapper>
          </div>
        </div>
      </section>
    </>
  );
}
