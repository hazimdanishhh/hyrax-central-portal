import { Desktop, SquaresFour, Table } from "phosphor-react";
import CardLayout from "../../../../components/cardLayout/CardLayout";
import CardSection from "../../../../components/cardSection/CardSection";
import LoadingIcon from "../../../../components/loadingIcon/LoadingIcon";
import { useTheme } from "../../../../context/ThemeContext";
import useITAssets from "../../../../hooks/useITAssets";
import SectionHeader from "../../../../components/sectionHeader/SectionHeader";
import "./IT_Assets.scss";
import ITAssetCard from "../../../../components/itAsset/itAssetCard/ITAssetCard";
import { useEffect, useState } from "react";
import Button from "../../../../components/buttons/button/Button";
import ITAssetTable from "../../../../components/itAsset/itAssetTable/ITAssetTable";
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

function IT_Assets({ setMessage }) {
  const { darkMode } = useTheme();
  const { assets, loading, error } = useITAssets({ setMessage });
  const [layout, setLayout] = useState(1); // 1: Card, 2: Table
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Hooks for IT asset filter data
  const { categories, loading: categoriesLoading } = useITAssetCategory();
  const { subcategories, loading: subcategoriesLoading } =
    useITAssetSubcategory();
  const { statuses, loading: statusesLoading } = useITAssetStatus();
  const { conditions, loading: conditionsLoading } = useITAssetCondition();
  const { operatingSystems, loading: osLoading } = useITAssetOS();
  const { employees, loading: employeesLoading } = useEmployees({ setMessage });
  const { departments, loading: departmentsLoading } = useDepartments();

  const columns = itAssetTableConfig({
    categories,
    subcategories,
    statuses,
    conditions,
    operatingSystems,
    employees,
    departments,
  });

  // Filter Config
  const itAssetsFilterConfig = [
    {
      key: "category",
      label: "Category",
      options: categories.map((c) => c.name),
    },
    {
      key: "subcategory",
      label: "Subcategory",
      options: subcategories.map((s) => s.name),
    },
    {
      key: "status",
      label: "Status",
      options: statuses.map((s) => s.name),
    },
    {
      key: "condition",
      label: "Condition",
      options: conditions.map((c) => c.name),
    },
    {
      key: "os",
      label: "OS",
      options: operatingSystems.map((o) => o.name),
    },
  ];

  // Search + Filter logic for IT assets
  const {
    search,
    setSearch,
    filters,
    setFilters,
    data: filteredAssets,
  } = useSearchFilter({
    data: assets, // `assets` is your ITAssetTable data
    searchFields: ["asset_name", "asset_code", "serial_number"], // searchable fields
    filterMap: {
      category: (asset, value) => asset.asset_category?.name === value,
      subcategory: (asset, value) => asset.asset_subcategory?.name === value,
      status: (asset, value) => asset.asset_status?.name === value,
      condition: (asset, value) => asset.asset_condition?.name === value,
      os: (asset, value) => asset.operating_system?.name === value,
    },
  });

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

  // Sidebar handlers
  function handleOpenSidebar(asset) {
    setSelectedAsset(asset);
    setSidebarOpen(true);
  }

  function handleCloseSidebar() {
    setSidebarOpen(false);
    setSelectedAsset(null);
  }

  function handleSaveSidebar(updatedData) {
    console.log("Save this asset:", updatedData);
    // TODO: call API or update state
    setSidebarOpen(false);
  }

  function handleDeleteSidebar(asset) {
    console.log("Delete this asset:", asset);
    // TODO: call API to delete
    setSidebarOpen(false);
  }

  // Wait for all filter data to load
  if (
    loading ||
    categoriesLoading ||
    subcategoriesLoading ||
    statusesLoading ||
    conditionsLoading ||
    osLoading ||
    employeesLoading ||
    departmentsLoading
  ) {
    return <LoadingIcon />;
  }

  return (
    <>
      <section className={darkMode ? "sectionDark" : "sectionLight"}>
        <div className="sectionWrapper">
          <div className="sectionContent">
            <Breadcrumbs icon={Desktop} current="IT Assets" />

            <CardWrapper>
              <div className="itAssetsHeader">
                <SearchFilterBar
                  search={search}
                  onSearchChange={setSearch}
                  filters={filters}
                  onFilterChange={setFilters}
                  filterConfig={itAssetsFilterConfig}
                  placeholder="Search assets..."
                />
                {layout === 1 ? (
                  <Button
                    icon2={SquaresFour}
                    tooltipName="Card View"
                    style="button buttonType3 textXXS"
                    name="Card View"
                    onClick={() => setLayout(2)}
                  />
                ) : (
                  <Button
                    icon2={Table}
                    tooltipName="Table View"
                    style="button buttonType3 textXXS"
                    name="Table View"
                    onClick={() => setLayout(1)}
                  />
                )}
              </div>

              <div className="itAssetsHeader">
                {!paginatedData.length ? (
                  <p className="textRegular textXXS">No results found</p>
                ) : error ? (
                  <p className="textRegular textXXS">Error loading results</p>
                ) : (
                  <p className="textRegular textXXS">
                    <strong>Total Result: </strong>
                    {paginatedData.length} / {filteredAssets.length}
                  </p>
                )}
              </div>

              {layout === 1 ? (
                <>
                  {/* <DataTable
                    data={paginatedData}
                    columns={columns}
                    rowKey="id"
                  />
                  <CardLayout style="cardLayout2">
                    <button
                      className="button buttonType2"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((p) => p - 1)}
                    >
                      Previous
                    </button>

                    <button
                      className="button buttonType2"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage((p) => p + 1)}
                    >
                      Next
                    </button>
                  </CardLayout> */}
                  <DataTable
                    data={paginatedData.map((a) => ({
                      ...a,
                      onClick: handleOpenSidebar,
                    }))}
                    columns={columns}
                    rowKey="id"
                  />
                </>
              ) : (
                <>
                  <CardLayout style="cardLayout2">
                    {paginatedData.map((asset) => (
                      <ITAssetCard
                        key={asset.id}
                        asset={asset}
                        onClick={() => handleOpenSidebar(asset)}
                      />
                    ))}
                  </CardLayout>
                  <CardLayout style="cardLayout2">
                    <button
                      className="button buttonType2"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((p) => p - 1)}
                    >
                      Previous
                    </button>

                    <button
                      className="button buttonType2"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage((p) => p + 1)}
                    >
                      Next
                    </button>
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
