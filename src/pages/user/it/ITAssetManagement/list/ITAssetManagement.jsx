// pages/user/it/it_assets/IT_Assets.jsx
import {
  CheckCircleIcon,
  DesktopIcon,
  PencilSimpleLineIcon,
  PlusCircleIcon,
  UserMinusIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import CardLayout from "../../../../../components/cardLayout/CardLayout";
import LoadingIcon from "../../../../../components/loadingIcon/LoadingIcon";
import { useTheme } from "../../../../../context/ThemeContext";
import "./ITAssetManagement.scss";
import { useMemo, useState } from "react";
import CardWrapper from "../../../../../components/cardWrapper/CardWrapper";
import Breadcrumbs from "../../../../../components/breadcrumbs/Breadcrumbs";
import SearchFilterBar from "../../../../../components/searchFliterBar/SearchFilterBar";
import DataTable from "../../../../../components/dataTable/DataTable";
import { itAssetTableConfig } from "./tableConfig";
import DataSidebar from "../../../../../components/dataSidebar/DataSidebar";
import { AnimatePresence } from "framer-motion";
import ITAssetList from "../../../../../components/itAsset/itAssetList/ITAssetList";
import useITAssetMutations from "../../../../../features/it/assets/private/hooks/useITAssetMutations";
import ActiveFiltersBar from "../../../../../components/crud/activeFiltersBar/ActiveFiltersBar";
import PageHeader from "../../../../../components/crud/pageHeader/PageHeader";
import { getITAssetsFilterConfig } from "./filterConfig";
import PageTab from "../../../../../components/navigation/pageTab/PageTab";
import { getAssetsLayoutConfig } from "./layoutConfig";
import ActionModal from "../../../../../components/modals/actionModal/ActionModal";
import PageLayout from "../../../../../components/crud/pageLayout/PageLayout";
import PageResult from "../../../../../components/crud/pageResult/PageResult";
import NoResult from "../../../../../components/crud/noResult/NoResult";
import OverviewCards from "../../../../../components/crud/overviewCards/OverviewCards";
import { getITAssetsSortConfig } from "./sortConfig";
import SortBar from "../../../../../components/crud/sortBar/SortBar";
import { useQueryClient } from "@tanstack/react-query";
import usePaginatedQuery from "../../../../../hooks/usePaginatedQuery";
import { fetchITAssets } from "../../../../../features/it/assets/private/api/itAssets";
import { useITAssetsMetadata } from "../../../../../features/it/assets/private/hooks/useITAssetsMetadata";
import ChartCard from "../../../../../components/chartCard/ChartCard";
import PieChartRenderer from "../../../../../components/chartCard/PieChartRenderer";
import StackedBarRenderer from "../../../../../components/chartCard/StackedBarRenderer";
import BarChartRenderer from "../../../../../components/chartCard/BarChartRenderer";
import {
  CONDITION_COLORS,
  RISK_COLORS,
  STATUS_COLORS,
  UTILIZATION_COLORS,
} from "../../../../../components/chartCard/chartColors";

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
    isFetching,
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
    error: metadataError,
  } = useITAssetsMetadata();
  const { createAsset, updateAsset, deleteAsset, saving, deleting } =
    useITAssetMutations();

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
  function handleRequestDelete(asset) {
    setPendingDeleteRow(asset);
    setSelectedRowId(asset.id);
    setModalType("delete");
    setModalOpen(true);
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
          <PageLayout
            layout={layout}
            setLayout={setLayout}
            options={layoutOptions}
            addButton={{
              name: "Add Asset",
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
            <CardLayout style="cardLayout1 cardPadding cardGapSmall">
              {assets.map((asset) => (
                <ITAssetList
                  key={asset.id}
                  asset={asset}
                  onClick={() => handleOpenSidebar(asset)}
                  saving={saving}
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
            saving={saving}
            deleting={deleting}
            creating={!selectedRow?.id}
          />
        )}
      </AnimatePresence>

      <ActionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalType === "save" ? "Save Asset" : "Delete Asset"}
        description={
          modalType === "save"
            ? "Are you sure you want to save these changes?"
            : "Are you sure you want to delete this asset?"
        }
        confirmText={modalType === "save" ? "Save" : "Delete"}
        loading={modalType === "save" ? saving : deleting}
        onConfirm={handleConfirmAction}
        modalType={modalType}
      />
    </>
  );
}
