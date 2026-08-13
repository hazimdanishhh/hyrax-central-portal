import { useTheme } from "../../../../context/ThemeContext";
import {
  ChartLineUpIcon,
  CheckCircleIcon,
  ClockCounterClockwiseIcon,
  DatabaseIcon,
  PulseIcon,
  XCircleIcon,
} from "@phosphor-icons/react";
import Breadcrumbs from "../../../../components/breadcrumbs/Breadcrumbs";
import CardWrapper from "../../../../components/cardWrapper/CardWrapper";
import CardLayout from "../../../../components/cardLayout/CardLayout";
import SectionHeader from "../../../../components/sectionHeader/SectionHeader";
import LoadingIcon from "../../../../components/loadingIcon/LoadingIcon";
import NoResult from "../../../../components/crud/noResult/NoResult";
import DataTable from "../../../../components/dataTable/DataTable";
import OverviewCards from "../../../../components/crud/overviewCards/OverviewCards";
import SearchFilterBar from "../../../../components/searchFilterBar/SearchFilterBar";
import ActiveFiltersBar from "../../../../components/crud/activeFiltersBar/ActiveFiltersBar";
import PageHeader from "../../../../components/crud/pageHeader/PageHeader";
import SortBar from "../../../../components/crud/sortBar/SortBar";
import PageResult from "../../../../components/crud/pageResult/PageResult";
import usePaginatedQuery from "../../../../hooks/usePaginatedQuery";
import { usePipelineCurrentState } from "../../../../features/system/pipelineStatus/private/hooks/usePipelineCurrentState";
import { usePipelineStats } from "../../../../features/system/pipelineStatus/private/hooks/usePipelineStats";
import { fetchPipelineRunLog } from "../../../../features/system/pipelineStatus/private/api/pipelineStatusService";
import {
  pipelineCurrentStateTableConfig,
  pipelineRunLogTableConfig,
} from "./tableConfig";
import { getPipelineRunLogFilterConfig } from "./filterConfig";
import { getPipelineRunLogSortConfig } from "./sortConfig";

/**
 * Read-only -- sap_pipeline_state/pipeline_run_log are both pipeline-owned,
 * written only by hyrax-data-platform's extractors. This page exists so
 * pipeline health is visible without checking Discord or SSHing in to read
 * rotated docker logs.
 */
export default function PipelineStatus() {
  const { darkMode } = useTheme();

  const { pipelines, isLoading: currentStateLoading } =
    usePipelineCurrentState();
  const { stats, isLoading: statsLoading } = usePipelineStats(7);

  const {
    data: runLog,
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
    isLoading: runLogLoading,
    isFetching: runLogFetching,
    error: runLogError,
  } = usePaginatedQuery({
    queryKey: "pipeline_run_log",
    queryFn: fetchPipelineRunLog,
    pageSize: 20,
    defaultSortBy: "run_at",
    defaultSortOrder: "descending",
  });

  const currentStateColumns = pipelineCurrentStateTableConfig();
  const runLogColumns = pipelineRunLogTableConfig();
  const runLogFilterConfig = getPipelineRunLogFilterConfig();
  const runLogSortConfig = getPipelineRunLogSortConfig();

  const statCards = stats
    ? [
        {
          label: "Runs (7d)",
          icon: PulseIcon,
          value: stats.totalCount,
          variant: "blueCardFill",
        },
        {
          label: "Success Rate (7d)",
          icon: CheckCircleIcon,
          value: stats.successRate != null ? `${stats.successRate}%` : "—",
          variant: stats.successRate < 80 ? "redCardFill" : "greenCardFill",
        },
        {
          label: "Failures (7d)",
          icon: XCircleIcon,
          value: stats.failedCount,
          variant: stats.failedCount > 0 ? "redCardFill" : "greenCardFill",
        },
      ]
    : [];

  return (
    <section className={darkMode ? "sectionDark" : "sectionLight"}>
      <div className="sectionWrapper">
        <div className="sectionContent">
          <Breadcrumbs icon={ChartLineUpIcon} current="Pipeline Status" />

          <CardWrapper>
            {!statsLoading && stats && <OverviewCards items={statCards} />}

            <SectionHeader title="Current State" icon={DatabaseIcon} />
            <div className="cardWrapperScroll generalCard">
              {currentStateLoading ? (
                <CardLayout style="cardLayoutFlexFull">
                  <LoadingIcon />
                </CardLayout>
              ) : pipelines.length === 0 ? (
                <NoResult />
              ) : (
                <DataTable
                  data={pipelines}
                  columns={currentStateColumns}
                  rowKey="pipeline_name"
                />
              )}
            </div>

            <SectionHeader
              title="Run History"
              icon={ClockCounterClockwiseIcon}
            />

            <SearchFilterBar
              search={search}
              onSearchChange={setSearch}
              filters={filters}
              onFilterChange={setFilters}
              filterConfig={runLogFilterConfig}
              placeholder="Search by pipeline name..."
            />

            <PageHeader>
              <SortBar
                sortBy={sortBy}
                setSortBy={setSortBy}
                sortOptions={runLogSortConfig}
                sortOrder={sortOrder}
                setSortOrder={setSortOrder}
              />
            </PageHeader>

            {hasActiveFilters && (
              <ActiveFiltersBar
                search={search}
                setSearch={setSearch}
                filters={activeFilters}
                setFilters={setFilters}
                filterConfig={runLogFilterConfig}
                resetParams={resetParams}
              />
            )}

            <PageResult
              data={runLog}
              totalCount={totalCount}
              page={page}
              setPage={setPage}
              totalPages={totalPages}
              error={runLogError}
            />

            <div className="cardWrapperScroll generalCard">
              {runLogLoading || runLogFetching ? (
                <CardLayout style="cardLayoutFlexFull">
                  <LoadingIcon />
                </CardLayout>
              ) : runLog.length === 0 ? (
                <NoResult />
              ) : runLogError ? (
                <NoResult title="Error loading results" />
              ) : (
                <DataTable data={runLog} columns={runLogColumns} rowKey="id" />
              )}
            </div>
          </CardWrapper>
        </div>
      </div>
    </section>
  );
}
