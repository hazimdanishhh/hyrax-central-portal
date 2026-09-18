// pages/user/sales/leads/targets/SalesTargetsManagement.jsx
import { useMemo, useState } from "react";
import { useNavigate, useMatch, useParams, useSearchParams } from "react-router-dom";
import AsyncSelect from "react-select/async";
import { AnimatePresence } from "framer-motion";
import { PlusCircleIcon, CaretRightIcon, CrosshairSimpleIcon } from "@phosphor-icons/react";
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
import SalesTargetDetail from "./SalesTargetDetail";
import { useAllSalesTargets } from "../../../../../features/sales/salesTargets/private/hooks/useAllSalesTargets";
import { searchEmployees } from "../../../../../features/sales/salesTargets/private/api/employeeSearch";
import { groupRowsByRepYear } from "../../../../../features/_shared/groupRowsByRepYear";
import { getSalesTargetsFilterConfig } from "./filterConfig";

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [
  CURRENT_YEAR - 1,
  CURRENT_YEAR,
  CURRENT_YEAR + 1,
  CURRENT_YEAR + 2,
];

/**
 * Sales Targets management (Forecast 1 -- CRM pipeline quota per rep).
 * Sales-manager-only. Grouped by (lead_owner_id, year) -- click a tile to
 * drill into that rep+year's 12 months (SalesTargetDetail.jsx), where each
 * month is created/edited/deleted independently. Not DataTable/DataForm
 * anymore: a flat row-per-month table let a free date picker create a
 * wrong-day row (silently "fixed" after the fact by the mutation layer's
 * normalizeTargetMonth) -- grouping by rep+year and only ever constructing
 * the date server-side-of-the-UI (see monthGrid.js) closes that gap
 * structurally instead of just papering over it.
 */
export default function SalesTargetsManagement() {
  const navigate = useNavigate();
  const isAddingOpen = !!useMatch("/app/sales/leads/targets/new");
  const { ownerId, year } = useParams();
  const detailOpen = !!(ownerId && year);
  const [searchParams, setSearchParams] = useSearchParams();

  const { targets, isLoading, isFetching, error } = useAllSalesTargets();

  const ownerFilter = searchParams.get("owner") || "";
  const filters = useMemo(() => ({ owner: ownerFilter }), [ownerFilter]);

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

  const filterConfig = getSalesTargetsFilterConfig();
  // ActiveFiltersBar expects [key, value] entries (mirrors
  // usePaginatedQuery's own activeFilters shape), not the plain filters
  // object SearchFilterBar/setFilters use.
  const activeFilters = useMemo(
    () => Object.entries(filters).filter(([, value]) => value !== "" && value != null),
    [filters],
  );
  const hasActiveFilters = activeFilters.length > 0;

  const groups = useMemo(() => {
    const filtered = ownerFilter
      ? targets.filter((t) => t.lead_owner_id === ownerFilter)
      : targets;

    return groupRowsByRepYear({
      rows: filtered,
      getRepKey: (t) => t.lead_owner_id,
      getRepLabel: (t) => t.employee?.full_name || "Unknown",
      getMonthDate: (t) => t.target_month,
      getRevenue: (t) => t.target_revenue,
    });
  }, [targets, ownerFilter]);

  const hasData = groups.length > 0;

  const [pickedRep, setPickedRep] = useState(null);
  const [pickedYear, setPickedYear] = useState(CURRENT_YEAR);

  function handleCloseAdd() {
    setPickedRep(null);
    setPickedYear(CURRENT_YEAR);
    navigate(`/app/sales/leads/targets?${searchParams.toString()}`);
  }

  function handleCloseDetail() {
    navigate(`/app/sales/leads/targets?${searchParams.toString()}`);
  }

  return (
    <>
      <PageTitle
        title="Pipeline Targets"
        subtitle="Set and manage pipeline targets to track progress and performance against goals"
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
              name: "Add Target",
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
          <NoResult title="No targets set for this rep/year yet." />
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
                revenueLabel="Total Pipeline Target"
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
            title="Add Target"
            icon={CrosshairSimpleIcon}
            open={isAddingOpen}
            onClose={handleCloseAdd}
            isEditing={false}
            hideDelete
          >
            <div className="dataSidebarSection" style={{ margin: "0.8rem", display: "flex", flexDirection: "column", gap: "0.8rem" }}>
              <p className="textRegular textXS">
                Pick a rep and a year to open its monthly targets.
              </p>

              <AsyncSelect
                unstyled
                className="selectContainer"
                classNamePrefix="reactSelect"
                cacheOptions
                defaultOptions
                loadOptions={searchEmployees}
                value={pickedRep}
                onChange={setPickedRep}
                placeholder="Search rep..."
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
            title="Monthly Targets"
            icon={CrosshairSimpleIcon}
            open={detailOpen}
            onClose={handleCloseDetail}
            isEditing={false}
            hideDelete
          >
            <SalesTargetDetail ownerId={ownerId} year={year} />
          </DataSidebar>
        )}
      </AnimatePresence>
    </>
  );
}
