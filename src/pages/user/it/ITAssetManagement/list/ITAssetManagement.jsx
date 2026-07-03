// pages/user/it/ITAssetManagement/list/ITAssetManagement.jsx
import { PencilSimpleLineIcon, PlusCircleIcon } from "@phosphor-icons/react";
import CardLayout from "../../../../../components/cardLayout/CardLayout";
import LoadingIcon from "../../../../../components/loadingIcon/LoadingIcon";
import { useTheme } from "../../../../../context/ThemeContext";
import "./ITAssetManagement.scss";
import { useState } from "react";
import SearchFilterBar from "../../../../../components/searchFilterBar/SearchFilterBar";
import DataTable from "../../../../../components/dataTable/DataTable";
import { itAssetTableConfig } from "./tableConfig";
import DataSidebar from "../../../../../components/dataSidebar/DataSidebar";
import { AnimatePresence } from "framer-motion";
import ITAssetList from "../../../../../components/itAsset/itAssetList/ITAssetList";
import ActiveFiltersBar from "../../../../../components/crud/activeFiltersBar/ActiveFiltersBar";
import PageHeader from "../../../../../components/crud/pageHeader/PageHeader";
import { getITAssetsFilterConfig } from "./filterConfig";
import { getAssetsLayoutConfig } from "./layoutConfig";
import ActionModal from "../../../../../components/modals/actionModal/ActionModal";
import PageActions from "../../../../../components/crud/pageActions/PageActions";
import PageResult from "../../../../../components/crud/pageResult/PageResult";
import NoResult from "../../../../../components/crud/noResult/NoResult";
import { getITAssetsSortConfig } from "./sortConfig";
import SortBar from "../../../../../components/crud/sortBar/SortBar";
import { useQueryClient } from "@tanstack/react-query";
import usePaginatedQuery from "../../../../../hooks/usePaginatedQuery";
import useCrudActionState from "../../../../../hooks/useCrudActionState";
import { fetchITAssets } from "../../../../../features/it/assets/private/api/itAssets";
import { useITAssetsMetadata } from "../../../../../features/it/assets/private/hooks/useITAssetsMetadata";
import useITAssetMutations from "../../../../../features/it/assets/private/hooks/useITAssetMutations";

/**
 * IT Asset Management Page
 * This is private IT asset data
 * Server-side filtering and pagination
 */
export default function ITAssetManagement() {
  const queryClient = useQueryClient();
  const { darkMode } = useTheme();
  const [layout, setLayout] = useState(0); // 0: List, 1: Table
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
    data: assets,
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
    isLoading: assetsLoading,
    isFetching: assetsFetching,
    error: assetsError,
  } = usePaginatedQuery({
    queryKey: "itAssets",
    queryFn: fetchITAssets,
    pageSize: 20,
    defaultSortBy: "asset_code",
  });

  // ==============
  // METADATA
  // ==============
  const {
    categories,
    subcategories,
    statuses,
    conditions,
    operatingSystems,
    manufacturers,
    departments,
    employees,
    isLoading: metadataLoading,
    isFetching: metadataFetching,
    error: metadataError,
  } = useITAssetsMetadata();
  const {
    createAsset,
    updateAsset,
    deleteAsset,
    bulkDeleteAssets,
    bulkUpdateAssets,
    creating,
    updating,
    deleting,
    bulkDeleting,
    bulkUpdating,
  } = useITAssetMutations();

  // ==============
  // CONFIG
  // ==============
  const layoutOptions = getAssetsLayoutConfig();
  const sortOptions = getITAssetsSortConfig();

  // ==============
  // DATA LOADING
  // ==============
  const isLoading = assetsLoading || metadataLoading;
  const error = assetsError || metadataError;
  const isFetching = assetsFetching || metadataFetching;
  const isSaving = creating || updating || bulkUpdating;
  const hasData = assets.length > 0;

  // ==============
  // TABLE CONFIG
  // ==============
  const columns = itAssetTableConfig({
    categories,
    subcategories,
    statuses,
    conditions,
    operatingSystems,
    employees,
    departments,
    manufacturers,
  });

  // ==============
  // FILTER CONFIG
  // ==============
  const filterConfig = getITAssetsFilterConfig({
    categories,
    subcategories,
    statuses,
    conditions,
    operatingSystems,
    departments,
    employees,
    manufacturers,
  });

  // ==============
  // SIDEBAR OPEN & CLOSE
  // ==============
  function handleOpenSidebar(asset) {
    setSelectedRow(asset);
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
        await deleteAsset(selectedRowId);
      }

      if (modalType === "save") {
        const data = pendingSaveRow;

        if (data.id) {
          await updateAsset(data);
        } else {
          await createAsset(data);
        }
      }

      await queryClient.invalidateQueries({
        queryKey: ["itAssets"],
      });

      setSidebarOpen(false);
      setSelectedRow(null);
      closeActionModal();
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <>
      {/* TABLE LIST TAB */}
      <>
        {/* SEARCH AND FILTER BAR */}
        <SearchFilterBar
          search={search}
          onSearchChange={setSearch}
          filters={filters}
          onFilterChange={setFilters}
          filterConfig={filterConfig}
          placeholder="Search assets..."
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
            actionButtons={[
              {
                name: "Add Asset",
                icon: PlusCircleIcon,
                onClick: () => {
                  setSelectedRow({});
                  setSidebarOpen(true);
                },
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

        {/* RESULT NUMBER + NEXT AND PREVIOUS BUTTONS */}
        <PageResult
          data={assets}
          totalCount={totalCount}
          page={page}
          setPage={setPage}
          totalPages={totalPages}
          error={error}
        />

        {/* TABLE DISPLAY UI */}
        <CardLayout style="cardWrapperScroll generalCard">
          {isLoading || isFetching ? (
            <CardLayout style="cardLayoutFlexFull">
              <LoadingIcon />
            </CardLayout>
          ) : !hasData || error ? (
            <NoResult />
          ) : layout === 1 ? (
            // TABLE LAYOUT
            <DataTable
              data={assets}
              columns={columns}
              rowKey="id"
              onRowClick={handleOpenSidebar}
            />
          ) : (
            // LIST LAYOUT
            <CardLayout style="cardLayout1 cardPaddingSmall cardGapSmall">
              {assets.map((asset) => (
                <ITAssetList
                  key={asset.id}
                  asset={asset}
                  onClick={() => handleOpenSidebar(asset)}
                  saving={isSaving}
                  deleting={deleting}
                />
              ))}
            </CardLayout>
          )}
        </CardLayout>
      </>

      {/* DATA SIDEBAR */}
      <AnimatePresence>
        {sidebarOpen && (
          <DataSidebar
            title={selectedRow?.id ? "Edit IT Asset" : "Add IT Asset"}
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
        title={modalType === "save" ? "Save Asset" : "Delete Asset"}
        description={
          modalType === "save"
            ? "Are you sure you want to save these changes?"
            : "Are you sure you want to delete this asset?"
        }
        confirmText={modalType === "save" ? "Save" : "Delete"}
        loading={modalType === "save" ? isSaving : deleting}
        onConfirm={handleConfirmAction}
        modalType={modalType}
      />
    </>
  );
}
