// pages/user/it/it_assets/IT_Assets.jsx
import {
  DesktopIcon,
  PencilSimpleLineIcon,
  PlusCircleIcon,
} from "@phosphor-icons/react";
import CardLayout from "../../../../components/cardLayout/CardLayout";
import LoadingIcon from "../../../../components/loadingIcon/LoadingIcon";
import { useTheme } from "../../../../context/ThemeContext";
import useITAssets from "../../../../hooks/useITAssets";
import "./ITAssetManagement.scss";
import { useEffect, useRef, useState } from "react";
import CardWrapper from "../../../../components/cardWrapper/CardWrapper";
import Breadcrumbs from "../../../../components/breadcrumbs/Breadcrumbs";
import SearchFilterBar from "../../../../components/searchFliterBar/SearchFilterBar";
import useITAssetCategory from "../../../../hooks/useITAssetCategory";
import useITAssetSubcategory from "../../../../hooks/useITAssetSubcategory";
import useITAssetStatus from "../../../../hooks/useITAssetStatus";
import useITAssetCondition from "../../../../hooks/useITAssetCondition";
import useITAssetOS from "../../../../hooks/useITAssetOS";
import DataTable from "../../../../components/dataTable/DataTable";
import { itAssetTableConfig } from "./tableConfig";
import DataSidebar from "../../../../components/dataSidebar/DataSidebar";
import { AnimatePresence } from "framer-motion";
import useEmployeesPublic from "../../../../hooks/useEmployeesPublic";
import useDepartments from "../../../../hooks/useDepartments";
import ITAssetList from "../../../../components/itAsset/itAssetList/ITAssetList";
import useITAssetMutations from "../../../../hooks/useITAssetMutations";
import ActiveFiltersBar from "../../../../components/crud/activeFiltersBar/ActiveFiltersBar";
import PageHeader from "../../../../components/crud/pageHeader/PageHeader";
import { getITAssetsFilterConfig } from "./filterConfig";
import useITAssetManufacturer from "../../../../hooks/useITAssetManufacturer";
import PageTab from "../../../../components/navigation/pageTab/PageTab";
import { getAssetsLayoutConfig } from "./layoutConfig";
import ActionModal from "../../../../components/modals/actionModal/ActionModal";
import { useSearchParams } from "react-router-dom";
import PageLayout from "../../../../components/crud/pageLayout/PageLayout";
import PageResult from "../../../../components/crud/pageResult/PageResult";
import NoResult from "../../../../components/noResult/NoResult";
import { getAssetsOverviewConfig } from "./overviewConfig";
import OverviewCards from "../../../../components/crud/overviewCards/OverviewCards";
import { getITAssetsSortConfig } from "./sortConfig";
import Button from "../../../../components/buttons/button/Button";
import SortBar from "../../../../components/crud/sortBar/SortBar";

/**
 * IT Asset Management Page
 * This is private IT asset data
 * Server-side filtering and pagination
 */
export default function ITAssetManagementOld() {
  const { darkMode } = useTheme();
  const [layout, setLayout] = useState(0); // 0: List, 1: Table
  const [selectedRow, setSelectedRow] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentTab, setCurrentTab] = useState(1);
  const [searchParams, setSearchParams] = useSearchParams();
  const [ready, setReady] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRowId, setSelectedRowId] = useState(null);
  const [pendingDeleteRow, setPendingDeleteRow] = useState(null);
  const [modalType, setModalType] = useState(null); // "save" | "reject"
  const [pendingSaveRow, setPendingSaveRow] = useState(null);
  const [sortBy, setSortBy] = useState("asset_code");
  const [sortOrder, setSortOrder] = useState("ascending"); // "ascending" | "descending"

  // ==============
  // HOOKS
  // ==============
  const {
    assets,
    setAssets,
    loading: assetsLoading,
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
  } = useITAssets({ ready, sortBy, sortOrder });
  const { categories, loading: categoriesLoading } = useITAssetCategory();
  const { subcategories, loading: subcategoriesLoading } =
    useITAssetSubcategory();
  const { statuses, loading: statusesLoading } = useITAssetStatus();
  const { conditions, loading: conditionsLoading } = useITAssetCondition();
  const { operatingSystems, loading: osLoading } = useITAssetOS();
  const { employees, loading: employeesLoading } = useEmployeesPublic();
  const { departments, loading: departmentsLoading } = useDepartments();
  const { manufacturers, loading: manufacturersLoading } =
    useITAssetManufacturer();
  const { createAsset, updateAsset, deleteAsset, saving, deleting } =
    useITAssetMutations();
  const layoutOptions = getAssetsLayoutConfig();
  const overviewItems = getAssetsOverviewConfig(summary);
  const sortOptions = getITAssetsSortConfig();

  // ==============
  // DATA LOADING
  // ==============
  const isLoading =
    assetsLoading ||
    categoriesLoading ||
    subcategoriesLoading ||
    statusesLoading ||
    conditionsLoading ||
    osLoading ||
    employeesLoading ||
    departmentsLoading ||
    manufacturersLoading;

  const hasData = assets.length > 0;

  // ==============
  // Table Config
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
  // Filter Config
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
    const sortByParam = searchParams.get("sortBy") || "asset_code";
    const sortOrderParam = searchParams.get("sortOrder") || "ascending";

    const newFilters = {};
    for (const [key, value] of searchParams.entries()) {
      if (key !== "page" && key !== "search") {
        newFilters[key] = value;
      }
    }

    setPage(pageParam);
    setSearch(searchParam);
    setFilters(newFilters);
    setSortBy(sortByParam);
    setSortOrder(sortOrderParam);

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
      sortBy,
      sortOrder,
    };

    setSearchParams(params);
  }, [page, search, filters, sortBy, sortOrder]);

  // ==============
  // HYDRATION
  // ==============
  // useEffect(() => {
  //   setPage(1);
  // }, [search, filters, sortBy, sortOrder]);

  const hasHydrated = useRef(false);

  useEffect(() => {
    if (!hasHydrated.current) {
      hasHydrated.current = true;
      return;
    }

    setPage(1);
  }, [search, filters, sortBy, sortOrder]);

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

      await refetch({ page, search, filters, sortBy, sortOrder });

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
      <section className={darkMode ? "sectionDark" : "sectionLight"}>
        <div className="sectionWrapper">
          <div className="sectionContent">
            <Breadcrumbs icon={DesktopIcon} current="IT Assets" />

            <CardWrapper>
              <PageTab
                tabs={["Overview", "Assets List"]}
                currentTab={currentTab}
                onTabChange={(index) => setCurrentTab(index)}
              />

              {/* TABLE LIST TAB */}
              {currentTab === 1 && (
                <>
                  {/* OVERVIEW */}
                  <OverviewCards items={overviewItems} />

                  {/* SEARCH AND FILTER BAR */}
                  <SearchFilterBar
                    search={search}
                    onSearchChange={setSearch}
                    filters={filters}
                    onFilterChange={setFilters}
                    filterConfig={filterConfig}
                    placeholder="Search assets..."
                  />

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
                    data={assets}
                    totalCount={totalCount}
                    page={page}
                    setPage={setPage}
                    totalPages={totalPages}
                    error={error}
                  />

                  {/* TABLE DISPLAY UI */}
                  <CardLayout style="cardWrapperScroll generalCard">
                    {isLoading ? (
                      <CardLayout style="cardLayoutFlexFull">
                        <LoadingIcon />
                      </CardLayout>
                    ) : !hasData ? (
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
                      <CardLayout style="cardLayout1 cardPadding">
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
              )}
            </CardWrapper>
          </div>
        </div>
      </section>

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
