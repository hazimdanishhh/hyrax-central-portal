// pages/user/it/it_assets/IT_Assets.jsx
import {
  CaretLeftIcon,
  CaretRightIcon,
  DesktopIcon,
  LaptopIcon,
  MonitorIcon,
  PencilSimpleLineIcon,
  PercentIcon,
  PlusCircleIcon,
  SquaresFourIcon,
  TableIcon,
  UsersThreeIcon,
  XIcon,
} from "@phosphor-icons/react";
import CardLayout from "../../../../components/cardLayout/CardLayout";
import CardSection from "../../../../components/cardSection/CardSection";
import LoadingIcon from "../../../../components/loadingIcon/LoadingIcon";
import { useTheme } from "../../../../context/ThemeContext";
import useITAssets from "../../../../hooks/useITAssets";
import "./IT_Assets.scss";
import { useEffect, useState } from "react";
import Button from "../../../../components/buttons/button/Button";
import CardWrapper from "../../../../components/cardWrapper/CardWrapper";
import Breadcrumbs from "../../../../components/breadcrumbs/Breadcrumbs";
import SearchFilterBar from "../../../../components/searchFliterBar/SearchFilterBar";
import useSearchFilter from "../../../../hooks/useSearchFliter";
import useITAssetCategory from "../../../../hooks/useITAssetCategory";
import useITAssetSubcategory from "../../../../hooks/useITAssetSubcategory";
import useITAssetStatus from "../../../../hooks/useITAssetStatus";
import useITAssetCondition from "../../../../hooks/useITAssetCondition";
import useITAssetOS from "../../../../hooks/useITAssetOS";
import DataTable from "../../../../components/dataTable/DataTable";
import { itAssetTableConfig } from "../../../../data/itAssetTableConfig";
import DataSidebar from "../../../../components/dataSidebar/DataSidebar";
import { AnimatePresence } from "framer-motion";
import useEmployees from "../../../../hooks/useEmployees";
import useDepartments from "../../../../hooks/useDepartments";
import ITAssetList from "../../../../components/itAsset/itAssetList/ITAssetList";
import useITAssetMutations from "../../../../hooks/useITAssetMutations";
import ActiveFiltersBar from "../../../../components/crud/activeFiltersBar/ActiveFiltersBar";
import PageHeader from "../../../../components/crud/pageHeader/PageHeader";
import { getITAssetsFilterConfig } from "./filterConfig";
import useITAssetManufacturer from "../../../../hooks/useITAssetManufacturer";

function IT_Assets() {
  const { darkMode } = useTheme();
  const { assets, setAssets, loading, error, refetch } = useITAssets();
  const [layout, setLayout] = useState(2); // 1: Card, 2: Table
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ==============
  // Hooks for IT asset filter data
  // ==============
  const { categories, loading: categoriesLoading } = useITAssetCategory();
  const { subcategories, loading: subcategoriesLoading } =
    useITAssetSubcategory();
  const { statuses, loading: statusesLoading } = useITAssetStatus();
  const { conditions, loading: conditionsLoading } = useITAssetCondition();
  const { operatingSystems, loading: osLoading } = useITAssetOS();
  const { employees, loading: employeesLoading } = useEmployees();
  const { departments, loading: departmentsLoading } = useDepartments();
  const { manufacturers, loading: manufacturersLoading } =
    useITAssetManufacturer();
  const { createAsset, updateAsset, deleteAsset, saving, deleting } =
    useITAssetMutations();

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
  // Search + Filter logic for IT assets
  // ==============
  const {
    search,
    setSearch,
    filters,
    setFilters,
    data: filteredAssets,
  } = useSearchFilter({
    data: assets, // `assets` is your ITAssetTable data
    searchFields: ["asset_name", "asset_code", "serial_number", "asset_model"], // searchable fields
    filterMap: {
      category: (asset, value) => asset.asset_category?.name === value,
      subcategory: (asset, value) => asset.asset_subcategory?.name === value,
      status: (asset, value) => asset.asset_status?.name === value,
      condition: (asset, value) => asset.asset_condition?.name === value,
      os: (asset, value) => asset.operating_system?.name === value,
      department: (asset, value) => asset.asset_department?.name === value,
      employees: (asset, value) => asset.asset_user?.full_name === value,
      mdm: (asset, value) => asset.mdm_status === value,
      manufacturer: (asset, value) => asset.asset_manufacturer?.name === value,
    },
  });

  // =====================
  // OVERVIEW METRICS
  // =====================
  const totalAssets = assets.length;

  const activeAssets = assets.filter(
    (a) => a.asset_status?.name === "Active",
  ).length;

  const endpointAssets = assets.filter(
    (a) => a.asset_category?.name === "Endpoint",
  ).length;

  const faultyAssets = assets.filter(
    (a) => a.asset_condition?.name === "Faulty",
  ).length;

  const unassignedAssets = assets.filter((a) => !a.asset_user).length;

  const assignedAssets = assets.filter((a) => a.asset_user).length;

  const utilizationRate =
    totalAssets > 0 ? Math.round((activeAssets / totalAssets) * 100) : 0;

  const inactiveAssets = totalAssets > 0 ? totalAssets - activeAssets : 0;

  // ==============
  // ACTIVE FILTERS
  // ==============
  const activeFilters = Object.entries(filters).filter(
    ([_, value]) => value && value !== "",
  );
  const hasActiveFilters = search || activeFilters.length > 0;

  // parent component or hook
  const rowsPerPage = 20;
  const totalPages = Math.ceil(filteredAssets.length / rowsPerPage);

  // slice data for current page
  const [currentPage, setCurrentPage] = useState(1);
  const paginatedData = filteredAssets.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage,
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [filteredAssets]);

  // ==============
  // SIDEBAR OPEN & CLOSE
  // ==============
  function handleOpenSidebar(asset) {
    setSelectedAsset(asset);
    setSidebarOpen(true);
  }

  function handleCloseSidebar() {
    setSidebarOpen(false);
    setSelectedAsset(null);
  }

  // ==============
  // SAVE + UPDATE
  // ==============
  async function handleSaveSidebar(data) {
    try {
      let savedRow;

      if (data.id) {
        // UPDATE
        const updatedRows = await updateAsset(data);
        savedRow = updatedRows?.[0];
        setAssets((prev) =>
          prev.map((a) => (a.id === savedRow.id ? savedRow : a)),
        );
      } else {
        // CREATE
        savedRow = await createAsset(data);
        setAssets((prev) => [savedRow, ...prev]); // add to top
      }

      setSidebarOpen(false);
    } catch (err) {}
  }

  // ==============
  // DELETE
  // ==============
  async function handleDeleteSidebar(asset) {
    try {
      await deleteAsset(asset.id);
      setAssets((prev) => prev.filter((a) => a.id !== asset.id));
      setSidebarOpen(false);
    } catch (err) {}
  }

  return (
    <>
      <section className={darkMode ? "sectionDark" : "sectionLight"}>
        <div className="sectionWrapper">
          <div className="sectionContent">
            <Breadcrumbs icon={DesktopIcon} current="IT Assets" />

            <CardWrapper>
              {/* OVERVIEW */}
              <CardLayout style="cardLayout4">
                <CardLayout style="generalCard">
                  <CardLayout style="cardLayoutFlex cardGapMedium cardLayoutNoPadding">
                    <MonitorIcon />
                    <h3 className="textRegular textS">Total Assets</h3>
                  </CardLayout>
                  <h2 className="textXL">{totalAssets}</h2>
                </CardLayout>

                <CardLayout style="generalCard greenCard">
                  <CardLayout style="cardLayoutFlex cardGapMedium cardLayoutNoPadding">
                    <UsersThreeIcon />
                    <h3 className="textRegular textS">Active Assets</h3>
                  </CardLayout>
                  <h2 className="textXL">{activeAssets}</h2>
                </CardLayout>

                <CardLayout style="generalCard redCard">
                  <CardLayout style="cardLayoutFlex cardGapMedium cardLayoutNoPadding">
                    <UsersThreeIcon />
                    <h3 className="textRegular textS">Inactive Assets</h3>
                  </CardLayout>
                  <h2 className="textXL">{inactiveAssets}</h2>
                </CardLayout>

                <CardLayout
                  style={
                    utilizationRate >= 80
                      ? "generalCard greenCard"
                      : utilizationRate >= 30 && utilizationRate < 80
                        ? "generalCard yellowCard"
                        : utilizationRate < 30
                          ? "generalCard redCard"
                          : "generalCard"
                  }
                >
                  <CardLayout style="cardLayoutFlex cardGapMedium cardLayoutNoPadding">
                    <PercentIcon />
                    <h3 className="textRegular textS">Asset Utilization</h3>
                  </CardLayout>
                  <h2 className="textXL">{utilizationRate}%</h2>
                </CardLayout>

                <CardLayout style="generalCard">
                  <CardLayout style="cardLayoutFlex cardGapMedium cardLayoutNoPadding">
                    <LaptopIcon />
                    <h3 className="textRegular textS">Endpoints</h3>
                  </CardLayout>
                  <h2 className="textXL">{endpointAssets}</h2>
                </CardLayout>

                <CardLayout style="generalCard">
                  <h3 className="textRegular textS">Unassigned (In Stock)</h3>
                  <h2 className="textXL">{unassignedAssets}</h2>
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
                  placeholder="Search assets..."
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
                  name="Add Asset"
                  icon2={PlusCircleIcon}
                  style="button buttonType3 textXXS"
                  onClick={() => {
                    setSelectedAsset({}); // empty object = new mode
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
              {loading ||
              categoriesLoading ||
              subcategoriesLoading ||
              statusesLoading ||
              conditionsLoading ||
              osLoading ||
              employeesLoading ||
              departmentsLoading ||
              manufacturersLoading ? (
                <LoadingIcon />
              ) : layout === 1 ? (
                <>
                  {totalPages > 1 && (
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
                          {paginatedData.length} / {filteredAssets.length}
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
                  <DataTable
                    data={paginatedData}
                    columns={columns}
                    rowKey="id"
                    onRowClick={handleOpenSidebar}
                  />
                </>
              ) : (
                <>
                  {totalPages > 1 && (
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
                          {paginatedData.length} / {filteredAssets.length}
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
                      {paginatedData.map((asset) => (
                        <ITAssetList
                          key={asset.id}
                          asset={asset}
                          onClick={() => handleOpenSidebar(asset)}
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
            title={selectedAsset?.id ? "Edit IT Asset" : "Add IT Asset"}
            icon={PencilSimpleLineIcon}
            open={sidebarOpen}
            onClose={handleCloseSidebar}
            rowData={selectedAsset}
            columns={columns}
            onSave={handleSaveSidebar}
            onDelete={handleDeleteSidebar}
          />
        )}
      </AnimatePresence>
    </>
  );
}

export default IT_Assets;
