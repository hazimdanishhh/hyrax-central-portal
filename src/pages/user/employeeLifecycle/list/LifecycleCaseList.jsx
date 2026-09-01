import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { ListChecksIcon } from "@phosphor-icons/react";
import { useTheme } from "../../../../context/ThemeContext";
import Breadcrumbs from "../../../../components/breadcrumbs/Breadcrumbs";
import CardWrapper from "../../../../components/cardWrapper/CardWrapper";
import CardLayout from "../../../../components/cardLayout/CardLayout";
import LoadingIcon from "../../../../components/loadingIcon/LoadingIcon";
import NoResult from "../../../../components/crud/noResult/NoResult";
import OverviewCards from "../../../../components/crud/overviewCards/OverviewCards";
import PageTitle from "../../../../components/pageTitle/PageTitle";
import SearchFilterBar from "../../../../components/searchFilterBar/SearchFilterBar";
import StatusTab from "../../../../components/crud/statusTab/StatusTab";
import { buildStatusTabs } from "../../../../functions/statusTabs";
import CaseCard from "../../../../components/employeeLifecycle/caseCard/CaseCard";
import { useLifecycleCases } from "../../../../features/employeeLifecycle/private/hooks/useLifecycleCases";
import { computeCasesOverview } from "../../../../features/employeeLifecycle/private/lifecycleCaseHelpers";
import { getLifecycleCasesOverviewConfig } from "./overviewConfig";
import {
  CASE_STATUSES,
  CASE_STATUS_TYPE,
} from "../../../../features/employeeLifecycle/private/lifecycleCaseStatusMeta";

/**
 * Shared list page for both onboarding and offboarding cases, mounted
 * identically under hr/ and it/ routes -- `caseType` is the only thing
 * that varies. Deliberately unpaginated/client-filtered, same shape as
 * ProjectTasksTab.jsx -- open lifecycle cases at any one company are an
 * inherently small, bounded set (see lifecycleCasesService.js's own header),
 * so a full server-side page/search/sort round trip would be over-building
 * for this feature. No "Add Case" button -- cases are exclusively
 * system-created by the backend triggers (see
 * docs/EMPLOYEE-LIFECYCLE-CHECKLIST-ARCHITECTURE.md), never user-created.
 */
export default function LifecycleCaseList({ caseType }) {
  const { darkMode } = useTheme();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const { cases, isLoading, error } = useLifecycleCases(caseType);
  const kpis = useMemo(() => computeCasesOverview(cases), [cases]);
  const overviewItems = getLifecycleCasesOverviewConfig(kpis);

  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "";
  const statusTabs = buildStatusTabs({
    searchParams,
    statuses: CASE_STATUSES,
    statusTypeMap: CASE_STATUS_TYPE,
  });

  function setSearch(value) {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (value) params.set("search", value);
        else params.delete("search");
        return params;
      },
      { replace: true },
    );
  }

  const filteredCases = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cases.filter((c) => {
      if (status && c.status !== status) return false;
      if (q && !(c.employee?.full_name || "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [cases, status, search]);

  function handleRowClick(lifecycleCase) {
    navigate(`${lifecycleCase.id}`);
  }

  const hasData = filteredCases.length > 0;
  const title = caseType === "OFFBOARDING" ? "Offboarding" : "Onboarding";

  return (
    <section className={darkMode ? "sectionDark" : "sectionLight"}>
      <div className="sectionWrapper">
        <div className="sectionContent">
          <Breadcrumbs icon={ListChecksIcon} current={title} />

          <CardWrapper>
            <PageTitle
              title={title}
              subtitle={`Every open and recently-closed ${title.toLowerCase()} case.`}
            />

            {isLoading ? (
              <CardLayout style="cardLayoutFlexFull">
                <LoadingIcon />
              </CardLayout>
            ) : error ? null : (
              <OverviewCards items={overviewItems} />
            )}

            <SearchFilterBar
              search={search}
              onSearchChange={setSearch}
              filters={{}}
              onFilterChange={() => {}}
              filterConfig={[]}
              placeholder="Search by employee name..."
            />

            <div className="statusTabsRow scrollbar">
              {statusTabs.map((tab) => (
                <StatusTab
                  key={tab.label}
                  to={tab.to}
                  label={tab.label}
                  themeType={tab.themeType}
                  isActive={tab.isActive}
                />
              ))}
            </div>

            <CardLayout style="cardWrapperScroll">
              {isLoading ? (
                <CardLayout style="cardLayoutFlexFull">
                  <LoadingIcon />
                </CardLayout>
              ) : !hasData || error ? (
                <NoResult
                  title={
                    error
                      ? "Error loading cases"
                      : cases.length === 0
                        ? `No ${title.toLowerCase()} cases yet`
                        : "No cases match your search/filters"
                  }
                />
              ) : (
                <CardLayout style="cardLayout1 cardGapSmall">
                  {filteredCases.map((lifecycleCase) => (
                    <CaseCard
                      key={lifecycleCase.id}
                      lifecycleCase={lifecycleCase}
                      onClick={() => handleRowClick(lifecycleCase)}
                    />
                  ))}
                </CardLayout>
              )}
            </CardLayout>
          </CardWrapper>
        </div>
      </div>
    </section>
  );
}
