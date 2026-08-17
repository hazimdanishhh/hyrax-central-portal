import { useState } from "react";
import { useTheme } from "../../../../../context/ThemeContext";
import usePaginatedQuery from "../../../../../hooks/usePaginatedQuery";
import useCrudActionState from "../../../../../hooks/useCrudActionState";
import { fetchProfiles } from "../../../../../features/superadmin/users/private/api/profiles";
import { useProfilesMetadata } from "../../../../../features/superadmin/users/private/hooks/useProfilesMetadata";
import useProfileMutations from "../../../../../features/superadmin/users/private/hooks/useProfileMutations";
import { useProfilesOverview } from "../../../../../features/superadmin/users/private/hooks/useProfilesOverview";
import CardLayout from "../../../../../components/cardLayout/CardLayout";
import { PencilSimpleLineIcon, UsersIcon } from "@phosphor-icons/react";
import { getUsersSortConfig } from "./sortConfig";
import { usersTableConfig } from "./tableConfig";
import { getUsersFilterConfig } from "./filterConfig";
import { getUsersOverviewConfig } from "./overviewConfig";
import Breadcrumbs from "../../../../../components/breadcrumbs/Breadcrumbs";
import CardWrapper from "../../../../../components/cardWrapper/CardWrapper";
import OverviewCards from "../../../../../components/crud/overviewCards/OverviewCards";
import SearchFilterBar from "../../../../../components/searchFilterBar/SearchFilterBar";
import PageHeader from "../../../../../components/crud/pageHeader/PageHeader";
import PageActions from "../../../../../components/crud/pageActions/PageActions";
import { getUsersLayoutConfig } from "./layoutConfig";
import SortBar from "../../../../../components/crud/sortBar/SortBar";
import ActiveFiltersBar from "../../../../../components/crud/activeFiltersBar/ActiveFiltersBar";
import PageResult from "../../../../../components/crud/pageResult/PageResult";
import LoadingIcon from "../../../../../components/loadingIcon/LoadingIcon";
import NoResult from "../../../../../components/crud/noResult/NoResult";
import DataTable from "../../../../../components/dataTable/DataTable";
import { AnimatePresence } from "framer-motion";
import DataSidebar from "../../../../../components/dataSidebar/DataSidebar";
import ActionModal from "../../../../../components/modals/actionModal/ActionModal";
import UserList from "../../../../../components/users/userList/UserList";
import { uploadAvatarPhoto } from "../../../../../services/storage/uploadAvatarPhoto";
import UserEmployeeLink from "./item/UserEmployeeLink";

export default function Users() {
  const { darkMode } = useTheme();
  const [layout, setLayout] = useState(2); // 1: Card, 2: Table
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
  // MUTATIONS
  // ==============
  const { updateProfile, deleteProfile, updating, deleting } =
    useProfileMutations();

  // ==============
  // OVERVIEW (KPI cards at the top of this same page -- no separate
  // Overview tab/route; deliberately a second, independent query from the
  // paginated list above, so a slow overview fetch never blocks the list)
  // ==============
  const {
    kpis,
    isLoading: overviewLoading,
    error: overviewError,
  } = useProfilesOverview();
  const overviewItems = getUsersOverviewConfig(kpis);

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
  // CONFIRM ACTION DELETE / SAVE / UPDATE
  // ==============
  async function handleConfirmAction() {
    try {
      if (modalType === "delete") {
        await deleteProfile(selectedRowId);
      }

      if (modalType === "save") {
        const data = { ...pendingSaveRow };

        // Upload only if a new photo was picked -- a File object means a
        // new capture/selection, a string means the existing URL was left
        // untouched. Mirrors AttendanceManagement.jsx's photo_url pattern.
        if (data.avatar_url instanceof File) {
          const uploaded = await uploadAvatarPhoto(data.avatar_url, data.id);

          data.avatar_url = uploaded.url;
        }

        await updateProfile(data);
      }

      handleCloseSidebar();
      closeActionModal();
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <section className={darkMode ? "sectionDark" : "sectionLight"}>
      <div className="sectionWrapper">
        <div className="sectionContent">
          <Breadcrumbs icon={UsersIcon} current="User Management" />

          <CardWrapper>
            {/* OVERVIEW CARDS */}
            {overviewLoading ? (
              <CardLayout style="cardLayoutFlexFull">
                <LoadingIcon />
              </CardLayout>
            ) : overviewError ? null : (
              <OverviewCards items={overviewItems} />
            )}

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
              {/* LAYOUT UI */}
              <PageActions
                layout={layout}
                setLayout={setLayout}
                options={layoutOptions}
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
                        saving={updating}
                        deleting={deleting}
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
                  title="Edit User"
                  icon={PencilSimpleLineIcon}
                  open={sidebarOpen}
                  onClose={handleCloseSidebar}
                  rowData={selectedRow}
                  columns={columns}
                  onSave={handleRequestSave}
                  onDelete={handleRequestDelete}
                  saving={updating}
                  deleting={deleting}
                >
                  {/* Manual profile <-> employee linking (superadmin
                      convenience, independent of the generic column-edit
                      save flow above) */}
                  <UserEmployeeLink selectedRow={selectedRow} />
                </DataSidebar>
              )}
            </AnimatePresence>

            {/* ACTION MODAL */}
            <ActionModal
              open={modalOpen}
              onClose={closeActionModal}
              title={modalType === "save" ? "Save User" : "Delete User"}
              description={
                modalType === "save"
                  ? "Are you sure you want to save these changes?"
                  : "Are you sure you want to delete this user?"
              }
              confirmText={modalType === "save" ? "Save" : "Delete"}
              loading={modalType === "save" ? updating : deleting}
              onConfirm={handleConfirmAction}
              modalType={modalType}
            />
          </CardWrapper>
        </div>
      </div>
    </section>
  );
}
