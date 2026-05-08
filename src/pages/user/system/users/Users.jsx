import { useState } from "react";
import { useNavigate } from "react-router";
import { useTheme } from "../../../../context/ThemeContext";
import usePaginatedQuery from "../../../../hooks/usePaginatedQuery";
import { fetchProfiles } from "../../../../features/superadmin/users/private/api/profiles";
import { useProfilesMetadata } from "../../../../features/superadmin/users/private/hooks/useProfilesMetadata";
import CardSection from "../../../../components/cardSection/CardSection";
import SectionHeader from "../../../../components/sectionHeader/SectionHeader";
import CardLayout from "../../../../components/cardLayout/CardLayout";
import {
  PencilSimpleLineIcon,
  PlusCircleIcon,
  UsersIcon,
} from "@phosphor-icons/react";
import { getUsersSortConfig } from "./sortConfig";
import { usersTableConfig } from "./tableConfig";
import { getUsersFilterConfig } from "./filterConfig";
import Breadcrumbs from "../../../../components/breadcrumbs/Breadcrumbs";
import CardWrapper from "../../../../components/cardWrapper/CardWrapper";
import SearchFilterBar from "../../../../components/searchFliterBar/SearchFilterBar";
import PageHeader from "../../../../components/crud/pageHeader/PageHeader";
import PageLayout from "../../../../components/crud/pageLayout/PageLayout";
import { getUsersLayoutConfig } from "./layoutConfig";
import SortBar from "../../../../components/crud/sortBar/SortBar";
import ActiveFiltersBar from "../../../../components/crud/activeFiltersBar/ActiveFiltersBar";
import PageResult from "../../../../components/crud/pageResult/PageResult";
import LoadingIcon from "../../../../components/loadingIcon/LoadingIcon";
import NoResult from "../../../../components/crud/noResult/NoResult";
import DataTable from "../../../../components/dataTable/DataTable";
import { AnimatePresence } from "framer-motion";
import DataSidebar from "../../../../components/dataSidebar/DataSidebar";
import ActionModal from "../../../../components/modals/actionModal/ActionModal";
import UserList from "../../../../components/users/userList/UserList";

export default function Users() {
  const navigate = useNavigate();
  const { darkMode } = useTheme();
  const [layout, setLayout] = useState(2); // 1: Card, 2: Table
  const [selectedRow, setSelectedRow] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRowId, setSelectedRowId] = useState(null);
  const [pendingDeleteRow, setPendingDeleteRow] = useState(null);
  const [modalType, setModalType] = useState(null); // "save" | "reject"
  const [pendingSaveRow, setPendingSaveRow] = useState(null);

  // ==============
  // HOOKS
  // ==============

  // MAIN PAGINATED DATA AND TABLE
  const {
    data: users,
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
    isLoading: usersLoading,
    isFetching,
    error: usersError,
  } = usePaginatedQuery({
    queryKey: "users",
    queryFn: fetchProfiles,
    pageSize: 20,
    defaultSortBy: "full_name",
  });

  // ==============
  // METADATA
  // ==============
  const {
    roles,
    departments,
    isLoading: metadataLoading,
    error: metadataError,
  } = useProfilesMetadata();

  // ==============
  // CONFIG
  // ==============
  const layoutOptions = getUsersLayoutConfig();
  const sortOptions = getUsersSortConfig();
  const columns = usersTableConfig({
    roles,
    departments,
  });
  const filterConfig = getUsersFilterConfig({
    roles,
    departments,
  });

  // ==============
  // DATA LOADING
  // ==============
  const isLoading = usersLoading || metadataLoading;
  const error = usersError || metadataError;
  const hasData = users.length > 0;

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

  // ==============
  // CONFIRM ACTION DELETE / SAVE / UPDATE
  // ==============
  async function handleConfirmAction() {
    console.log("test");
  }

  return (
    <>
      <section className={darkMode ? "sectionDark" : "sectionLight"}>
        <div className="sectionWrapper">
          <div className="sectionContent">
            <Breadcrumbs icon={UsersIcon} current="User Management" />

            <CardWrapper>
              {/* SEARCH AND FILTER BAR */}
              <SearchFilterBar
                search={search}
                onSearchChange={setSearch}
                filters={filters}
                onFilterChange={setFilters}
                filterConfig={filterConfig}
                placeholder="Search users..."
              />

              <PageHeader>
                {/* LAYOUT UI + ACTION BUTTONS */}
                <PageLayout
                  layout={layout}
                  setLayout={setLayout}
                  options={layoutOptions}
                  addButton={{
                    name: "Add User",
                    icon: PlusCircleIcon,
                    onClick: () => {
                      setSelectedRow({});
                      setSidebarOpen(true);
                    },
                  }}
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
                data={users}
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
                ) : layout === 1 ? (
                  // TABLE LAYOUT
                  <DataTable
                    data={users}
                    columns={columns}
                    rowKey="id"
                    onRowClick={handleOpenSidebar}
                  />
                ) : (
                  // LIST LAYOUT
                  <CardLayout style="cardLayout1 cardPaddingSmall cardGapSmall">
                    {users.map((user) => {
                      return (
                        <UserList
                          key={user.id}
                          user={user}
                          onClick={() => handleOpenSidebar(user)}
                          // saving={saving}
                          // deleting={deleting}
                        />
                      );
                    })}
                  </CardLayout>
                )}
              </div>

              {/* DATA SIDEBAR */}
              <AnimatePresence>
                {sidebarOpen && (
                  <DataSidebar
                    title={selectedRow?.id ? "Edit User" : "Add User"}
                    icon={PencilSimpleLineIcon}
                    open={sidebarOpen}
                    onClose={handleCloseSidebar}
                    rowData={selectedRow}
                    columns={columns}
                    onSave={handleRequestSave}
                    onDelete={handleRequestDelete}
                    // saving={saving}
                    // deleting={deleting}
                    creating={!selectedRow?.id}
                  >
                    {/* DATA SIDEBAR INTERNAL */}
                  </DataSidebar>
                )}
              </AnimatePresence>

              {/* ACTION MODAL */}
              <ActionModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                title={modalType === "save" ? "Save User" : "Delete User"}
                description={
                  modalType === "save"
                    ? "Are you sure you want to save these changes?"
                    : "Are you sure you want to delete this user?"
                }
                confirmText={modalType === "save" ? "Save" : "Delete"}
                // loading={modalType === "save" ? saving : deleting}
                onConfirm={handleConfirmAction}
                modalType={modalType}
              />
            </CardWrapper>
          </div>
        </div>
      </section>
    </>
  );
}
