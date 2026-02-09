import { Desktop, SquaresFour, Table } from "phosphor-react";
import CardLayout from "../../../../components/cardLayout/CardLayout";
import CardSection from "../../../../components/cardSection/CardSection";
import LoadingIcon from "../../../../components/loadingIcon/LoadingIcon";
import { useTheme } from "../../../../context/ThemeContext";
import useITAssets from "../../../../hooks/useITAssets";
import SectionHeader from "../../../../components/sectionHeader/SectionHeader";
import "./IT_Assets.scss";
import ITAssetCard from "../../../../components/itAsset/itAssetCard/ITAssetCard";
import { useState } from "react";
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

function IT_Assets({ setMessage }) {
  const { darkMode } = useTheme();
  const { assets, loading, error } = useITAssets({ setMessage });
  const [layout, setLayout] = useState(1); // 1: Card, 2: Table

  // Hooks for IT asset filter data
  const { categories, loading: categoriesLoading } = useITAssetCategory();
  const { subcategories, loading: subcategoriesLoading } =
    useITAssetSubcategory();
  const { statuses, loading: statusesLoading } = useITAssetStatus();
  const { conditions, loading: conditionsLoading } = useITAssetCondition();
  const { operatingSystems, loading: osLoading } = useITAssetOS();

  const columns = itAssetTableConfig({
    categories,
    subcategories,
    statuses,
    conditions,
    operatingSystems,
    conditions,
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

  // Wait for all filter data to load
  if (
    loading ||
    categoriesLoading ||
    subcategoriesLoading ||
    statusesLoading ||
    conditionsLoading ||
    osLoading
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
                {!filteredAssets.length ? (
                  <p className="textRegular textXXS">No results found</p>
                ) : error ? (
                  <p className="textRegular textXXS">Error loading results</p>
                ) : (
                  <p className="textRegular textXXS">
                    <strong>Total Result: </strong>
                    {filteredAssets.length}
                  </p>
                )}
              </div>

              {layout === 1 ? (
                <>
                  <DataTable data={filteredAssets} columns={columns} />
                </>
              ) : (
                <CardLayout style="cardLayout2">
                  {filteredAssets.map((asset) => (
                    <ITAssetCard key={asset.id} asset={asset} />
                  ))}
                </CardLayout>
              )}
            </CardWrapper>
          </div>
        </div>
      </section>
    </>
  );
}

export default IT_Assets;
