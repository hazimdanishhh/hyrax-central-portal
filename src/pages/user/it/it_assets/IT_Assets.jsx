// IT_Assets.jsx
import {
  DesktopIcon,
  PencilSimpleLineIcon,
  PlusCircleIcon,
  SquaresFourIcon,
  TableIcon,
  XIcon,
} from "@phosphor-icons/react";
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
import ITAssetList from "../../../../components/itAsset/itAssetList/ITAssetList";
import useITAssetMutations from "../../../../hooks/useITAssetMutations";
import MessageUI from "../../../../components/messageUI/MessageUI";

function IT_Assets({ setMessage }) {
  const { darkMode } = useTheme();
  const { assets, setAssets, loading, error, refetch } = useITAssets({
    setMessage,
  });
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

  // IT Asset Table Config
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
    {
      key: "department",
      label: "Department",
      options: departments.map((d) => d.name),
    },
    {
      key: "employees",
      label: "Employee",
      options: employees.map((e) => e.full_name),
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
    searchFields: ["asset_name", "asset_code", "serial_number", "employees"], // searchable fields
    filterMap: {
      category: (asset, value) => asset.asset_category?.name === value,
      subcategory: (asset, value) => asset.asset_subcategory?.name === value,
      status: (asset, value) => asset.asset_status?.name === value,
      condition: (asset, value) => asset.asset_condition?.name === value,
      os: (asset, value) => asset.operating_system?.name === value,
      department: (asset, value) => asset.asset_department?.name === value,
      employees: (asset, value) => asset.asset_user?.full_name === value,
    },
  });

  const activeFilters = Object.entries(filters).filter(
    ([_, value]) => value && value !== "",
  );

  const hasActiveFilters = search || activeFilters.length > 0;

  // parent component or hook
  const rowsPerPage = 150;
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

  // IT Asset Update and Delete Hook Function
  const { createAsset, updateAsset, deleteAsset, saving, deleting } =
    useITAssetMutations({
      setMessage,
    });

  // Sidebar handlers
  function handleOpenSidebar(asset) {
    setSelectedAsset(asset);
    setSidebarOpen(true);
  }

  function handleCloseSidebar() {
    setSidebarOpen(false);
    setSelectedAsset(null);
  }

  // ==============
  // SAVE
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
      <MessageUI setMessage={setMessage} />

      <section className={darkMode ? "sectionDark" : "sectionLight"}>
        <div className="sectionWrapper">
          <div className="sectionContent">
            <Breadcrumbs icon={DesktopIcon} current="IT Assets" />

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
              </div>

              <div className="itAssetsHeader">
                {hasActiveFilters && (
                  <div className="activeFiltersBar">
                    {search && (
                      <div className="filterTag textXXXS">
                        <span>
                          <strong>Search: </strong>
                          {search}
                        </span>
                        <Button onClick={() => setSearch("")} icon={XIcon} />
                      </div>
                    )}

                    {activeFilters.map(([key, value]) => (
                      <div key={key} className="filterTag textXXXS">
                        <span>
                          <strong>{key}: </strong>
                          {value}
                        </span>
                        <Button
                          onClick={() =>
                            setFilters((prev) => ({
                              ...prev,
                              [key]: "",
                            }))
                          }
                          icon={XIcon}
                        />
                      </div>
                    ))}

                    <Button
                      name="Clear All"
                      icon={XIcon}
                      style="button buttonTypeDelete2 textXXXS"
                      onClick={() => {
                        setSearch("");
                        setFilters({});
                      }}
                    />
                  </div>
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
                  <DataTable
                    data={paginatedData}
                    columns={columns}
                    rowKey="id"
                    onRowClick={handleOpenSidebar}
                  />
                  {totalPages > 1 && (
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
                  )}
                </>
              ) : (
                <>
                  <CardLayout style="cardLayout1">
                    {paginatedData.map((asset) => (
                      <ITAssetList
                        key={asset.id}
                        asset={asset}
                        onClick={() => handleOpenSidebar(asset)}
                      />
                    ))}
                  </CardLayout>
                  {totalPages > 1 && (
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
                  )}
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
            title="Edit IT Asset"
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
