import React from "react";
import SearchFilterBar from "../../searchFilterBar/SearchFilterBar";
import ActiveFiltersBar from "../activeFiltersBar/ActiveFiltersBar";
import SortBar from "../sortBar/SortBar";
import PageResult from "../pageResult/PageResult";
import { PlusCircleIcon } from "@phosphor-icons/react";
import PageActions from "../pageActions/PageActions";
import PageHeader from "../pageHeader/PageHeader";

function CrudFunctions({
  search,
  setSearch,
  filters,
  setFilters,
  filterConfig,
  placeholder,
  hasActiveFilters,
  activeFilters,
  resetParams,
  layout,
  setLayout,
  layoutOptions,
  actionButtons,
  sortBy,
  setSortBy,
  sortOptions,
  sortOrder,
  setSortOrder,
  data,
  totalCount,
  page,
  setPage,
  totalPages,
  error,
}) {
  return (
    <>
      {/* SEARCH AND FILTER BAR */}
      <SearchFilterBar
        search={search}
        onSearchChange={setSearch}
        filters={filters}
        onFilterChange={setFilters}
        filterConfig={filterConfig}
        placeholder={placeholder}
      />

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

      <PageHeader>
        {/* LAYOUT UI + ACTION BUTTONS */}
        <PageActions
          layout={layout}
          setLayout={setLayout}
          options={layoutOptions}
          actionButtons={actionButtons}
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

      {/* RESULT NUMBER + NEXT AND PREVIOUS BUTTONS */}
      <PageResult
        data={data}
        totalCount={totalCount}
        page={page}
        setPage={setPage}
        totalPages={totalPages}
        error={error}
      />
    </>
  );
}

export default CrudFunctions;
