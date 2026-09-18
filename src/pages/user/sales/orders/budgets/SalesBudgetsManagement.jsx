// pages/user/sales/orders/budgets/SalesBudgetsManagement.jsx
import { useMemo, useState } from "react";
import { useNavigate, useMatch, useParams, useSearchParams } from "react-router-dom";
import Select from "react-select";
import { AnimatePresence } from "framer-motion";
import { PlusCircleIcon, CaretRightIcon, WalletIcon } from "@phosphor-icons/react";
import CardLayout from "../../../../../components/cardLayout/CardLayout";
import LoadingIcon from "../../../../../components/loadingIcon/LoadingIcon";
import SearchFilterBar from "../../../../../components/searchFilterBar/SearchFilterBar";
import DataSidebar from "../../../../../components/dataSidebar/DataSidebar";
import ActiveFiltersBar from "../../../../../components/crud/activeFiltersBar/ActiveFiltersBar";
import NoResult from "../../../../../components/crud/noResult/NoResult";
import PageHeader from "../../../../../components/crud/pageHeader/PageHeader";
import PageActions from "../../../../../components/crud/pageActions/PageActions";
import Button from "../../../../../components/buttons/button/Button";
import PageTitle from "../../../../../components/pageTitle/PageTitle";
import RepPeriodSummaryCard from "../../../../../components/sales/repPeriodSummaryCard/RepPeriodSummaryCard";
import SalesBudgetDetail from "./SalesBudgetDetail";
import { useAllSalesBudgets } from "../../../../../features/sales/salesBudgets/private/hooks/useAllSalesBudgets";
import { useSalesBudgetsMetadata } from "../../../../../features/sales/salesBudgets/private/hooks/useSalesBudgetsMetadata";
import { groupRowsByRepYear } from "../../../../../features/_shared/groupRowsByRepYear";
import { getSalesBudgetsFilterConfig } from "./filterConfig";

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [
  CURRENT_YEAR - 1,
  CURRENT_YEAR,
  CURRENT_YEAR + 1,
  CURRENT_YEAR + 2,
];

/**
 * Sales Budgets management (Forecast 2 -- SAP invoice quota per rep).
 * Sales-manager-only. Grouped by (sales_rep_code, year) -- mirrors
 * SalesTargetsManagement.jsx exactly, keyed by the SAP-side rep identity
 * (bigint, via the eagerly-fetched sap_sales_persons list) instead of the
 * CRM-side lead_owner_id -- see that file's own header comment for why
 * this replaced the old flat row-per-month table + free date picker.
 */
export default function SalesBudgetsManagement() {
  const navigate = useNavigate();
  const isAddingOpen = !!useMatch("/app/sales/orders/budgets/new");
  const { repCode, year } = useParams();
  const detailOpen = !!(repCode && year);
  const [searchParams, setSearchParams] = useSearchParams();

  const { budgets, isLoading: budgetsLoading, isFetching, error } = useAllSalesBudgets();
  const {
    salesReps,
    isLoading: metadataLoading,
  } = useSalesBudgetsMetadata();

  const isLoading = budgetsLoading || metadataLoading;

  const repCodeFilter = searchParams.get("salesRepCode") || "";
  const filters = useMemo(() => ({ salesRepCode: repCodeFilter }), [repCodeFilter]);

  function setFilters(next) {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      Object.entries(next).forEach(([key, value]) => {
        if (value === undefined || value === null || value === "") {
          params.delete(key);
        } else {
          params.set(key, String(value));
        }
      });
      return params;
    });
  }

  function resetParams() {
    setSearchParams(new URLSearchParams());
  }

  const filterConfig = getSalesBudgetsFilterConfig({ salesReps });
  // ActiveFiltersBar expects [key, value] entries (mirrors
  // usePaginatedQuery's own activeFilters shape), not the plain filters
  // object SearchFilterBar/setFilters use.
  const activeFilters = useMemo(
    () => Object.entries(filters).filter(([, value]) => value !== "" && value != null),
    [filters],
  );
  const hasActiveFilters = activeFilters.length > 0;

  const groups = useMemo(() => {
    const filtered = repCodeFilter
      ? budgets.filter((b) => String(b.sales_rep_code) === repCodeFilter)
      : budgets;

    return groupRowsByRepYear({
      rows: filtered,
      getRepKey: (b) => b.sales_rep_code,
      getRepLabel: (b) => b.sales_rep?.sales_rep_name || "Unknown",
      getMonthDate: (b) => b.budget_month,
      getRevenue: (b) => b.budget_revenue,
    });
  }, [budgets, repCodeFilter]);

  const hasData = groups.length > 0;

  const repOptions = salesReps.map((r) => ({
    value: r.sales_rep_code,
    label: r.sales_rep_name,
  }));

  const [pickedRep, setPickedRep] = useState(null);
  const [pickedYear, setPickedYear] = useState(CURRENT_YEAR);

  function handleCloseAdd() {
    setPickedRep(null);
    setPickedYear(CURRENT_YEAR);
    navigate(`/app/sales/orders/budgets?${searchParams.toString()}`);
  }

  function handleCloseDetail() {
    navigate(`/app/sales/orders/budgets?${searchParams.toString()}`);
  }

  return (
    <>
      <PageTitle
        title="Sales Budgets"
        subtitle="Set and manage sales budgets to track progress and performance against goals"
      />

      <SearchFilterBar
        filters={filters}
        onFilterChange={setFilters}
        filterConfig={filterConfig}
        disableSearch
      />

      <PageHeader>
        <PageActions
          actionButtons={[
            {
              icon: PlusCircleIcon,
              name: "Add Budget",
              onClick: () => {
                navigate(`new?${searchParams.toString()}`);
              },
              style: "button buttonType5 greenFill buttonFull textXXS",
            },
          ]}
        />
      </PageHeader>

      {hasActiveFilters && (
        <ActiveFiltersBar
          filters={activeFilters}
          setFilters={setFilters}
          filterConfig={filterConfig}
          resetParams={resetParams}
        />
      )}

      <div className="cardWrapperScroll">
        {isLoading || isFetching ? (
          <CardLayout style="cardLayoutFlexFull">
            <LoadingIcon />
          </CardLayout>
        ) : !hasData ? (
          <NoResult title="No budgets set for this rep/year yet." />
        ) : error ? (
          <NoResult title="Error loading results" />
        ) : (
          <CardLayout style="cardLayout2 cardGapSmall">
            {groups.map((group) => (
              <RepPeriodSummaryCard
                key={`${group.repKey}::${group.year}`}
                repLabel={group.repLabel}
                year={group.year}
                totalRevenue={group.totalRevenue}
                filledMonths={group.filledMonths}
                revenueLabel="Total Revenue Budget"
                onClick={() =>
                  navigate(`${group.repKey}/${group.year}?${searchParams.toString()}`)
                }
              />
            ))}
          </CardLayout>
        )}
      </div>

      <AnimatePresence>
        {isAddingOpen && (
          <DataSidebar
            title="Add Budget"
            icon={WalletIcon}
            open={isAddingOpen}
            onClose={handleCloseAdd}
            isEditing={false}
            hideDelete
          >
            <div className="dataSidebarSection" style={{ margin: "0.8rem", display: "flex", flexDirection: "column", gap: "0.8rem" }}>
              <p className="textRegular textXS">
                Pick a rep and a year to open its monthly budgets.
              </p>

              <Select
                unstyled
                className="selectContainer"
                classNamePrefix="reactSelect"
                options={repOptions}
                value={pickedRep}
                onChange={setPickedRep}
                placeholder="Select rep..."
              />

              <select
                className="selectContainer"
                value={pickedYear}
                onChange={(e) => setPickedYear(Number(e.target.value))}
              >
                {YEAR_OPTIONS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>

              <Button
                name="Go to Months"
                icon={CaretRightIcon}
                style="button buttonType5 greenFill buttonFull textXXS"
                disabled={!pickedRep}
                onClick={() => {
                  const target = `${pickedRep.value}/${pickedYear}?${searchParams.toString()}`;
                  setPickedRep(null);
                  setPickedYear(CURRENT_YEAR);
                  navigate(target);
                }}
              />
            </div>
          </DataSidebar>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {detailOpen && (
          <DataSidebar
            title="Monthly Budgets"
            icon={WalletIcon}
            open={detailOpen}
            onClose={handleCloseDetail}
            isEditing={false}
            hideDelete
          >
            <SalesBudgetDetail repCode={repCode} year={year} />
          </DataSidebar>
        )}
      </AnimatePresence>
    </>
  );
}
