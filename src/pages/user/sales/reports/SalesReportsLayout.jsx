// src/pages/user/sales/reports/SalesReportsLayout.jsx

import { useRef } from "react";
import {
  Navigate,
  NavLink,
  Outlet,
  useLocation,
  useSearchParams,
} from "react-router-dom";
import "./SalesReports.scss";
import {
  ChartBarIcon,
  GlobeHemisphereEastIcon,
  WarningCircleIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import { useTheme } from "../../../../context/ThemeContext";
import { useAccessControl } from "../../../../context/AccessControlContext";
import Breadcrumbs from "../../../../components/breadcrumbs/Breadcrumbs";
import CardWrapper from "../../../../components/cardWrapper/CardWrapper";
import PeriodSelector from "../../../../components/periodSelector/PeriodSelector";
import SearchFilterBar from "../../../../components/searchFilterBar/SearchFilterBar";
import ActiveFiltersBar from "../../../../components/crud/activeFiltersBar/ActiveFiltersBar";
import ExportActions from "../../../../components/exportActions/ExportActions";
import { useSalesReportsMetadata } from "../../../../features/sales/reports/private/hooks/useSalesReportsMetadata";
import { describePeriod } from "../../../../functions/periodRange";
import { formatDateTime } from "../../../../functions/formatDate";
import { getFilterConfig } from "./config/filterConfig";
import { salesReportsTabs } from "./salesReportsTabs";
import TabScroller from "@/components/navigation/tabScroller/TabScroller";

// The page's only filters, all in the URL so a link reproduces the view.
const FILTER_KEYS = ["startDate", "endDate", "owner"];

/**
 * Sales Reports shell: the period, the tab bar, the salesperson filter, and
 * the active tab below. Plan: docs/sales/SALES-REPORTS-TABS-PLAN.md; rules
 * every tab follows: docs/portal/DASHBOARD-CONVENTIONS.md §8.
 *
 *   Last updated
 *   PeriodSelector                 ?startDate&endDate
 *   [ Summary | Pipeline | Orders | Invoicing | Collections | Team | Forecast ]
 *                                  /reports/<tab>
 *   SearchFilterBar (Salesperson, Export)   ?owner
 *   <active tab>
 *
 * The period and salesperson apply to every tab: switching tab keeps them
 * (tab links carry the query string). Tabs are path segments, not ?tab=, so
 * a tab never ends up in the filters sent to an RPC.
 *
 * Each tab fetches its own RPC (useSalesReportTab) -- only the open one
 * runs. Tabs get the shared state through the Outlet context.
 *
 * The Forecast tab is company-wide: the salesperson filter does not apply
 * there, so it is replaced by a note instead of silently being ignored.
 */
export default function SalesReportsLayout() {
  const { darkMode } = useTheme();
  const { canAccess } = useAccessControl();
  const { pathname, search } = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const contentRef = useRef(null);

  const { owners, dataFreshness } = useSalesReportsMetadata();
  const filterConfig = getFilterConfig({ owners });

  const filters = Object.fromEntries(
    FILTER_KEYS.map((key) => [key, searchParams.get(key) || ""]),
  );

  // Merge updates into the URL; empty values remove the key.
  function setFilters(updates) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        Object.entries(updates).forEach(([key, value]) => {
          if (!FILTER_KEYS.includes(key)) return;
          if (value === undefined || value === null || value === "") {
            next.delete(key);
          } else {
            next.set(key, String(value));
          }
        });
        return next;
      },
      { replace: true },
    );
  }

  const activeTab =
    salesReportsTabs.find((tab) => pathname.endsWith(`/${tab.path}`)) ??
    salesReportsTabs[0];
  const isForecast = activeTab.path === "forecast";

  const period = describePeriod(filters);
  const ownerName = owners.find(
    (o) => String(o.id) === String(filters.owner),
  )?.full_name;

  // Who can follow a tile through to which list page. Every link degrades to
  // no link for a viewer who couldn't open the target.
  const access = {
    orders: canAccess({ departments: ["SAL", "MGM"] }),
    invoices: canAccess({ departments: ["FIN", "MGM"] }),
    payments: canAccess({ departments: ["FIN", "MGM"] }),
  };

  // The salesperson chip (the period is shown by PeriodSelector itself).
  const ownerChips = filters.owner ? [["owner", filters.owner]] : [];

  const exportPdf = {
    targetRef: contentRef,
    fileName: `Sales_Reports_${activeTab.label}`,
    reportTitle: `Sales Reports — ${activeTab.label}`,
    logoUrl: "/logos/logo.png",
    subtitle: `${period.title} (${period.range})${
      ownerName && !isForecast ? ` · Salesperson: ${ownerName}` : ""
    }${isForecast ? " · Company-wide" : ""}`,
  };

  return (
    <section className={darkMode ? "sectionDark" : "sectionLight"}>
      <div className="sectionWrapper">
        <div className="sectionContent">
          <Breadcrumbs icon={ChartBarIcon} current="Sales Reports" />

          <CardWrapper>
            {dataFreshness?.asOf && (
              <p
                className="textXXS textLight"
                style={{ padding: "0 1rem" }}
                title={
                  dataFreshness.hasFailedPipeline
                    ? "One or more data syncs failed — figures may be more stale than this timestamp suggests"
                    : undefined
                }
              >
                <span className="textBold">Last Updated:</span>{" "}
                {formatDateTime(dataFreshness.asOf)}
                {dataFreshness.hasFailedPipeline && (
                  <>
                    {" "}
                    <WarningIcon size={12} weight="fill" color="#d76363" /> Sync
                    issue detected
                  </>
                )}
              </p>
            )}

            <PeriodSelector filters={filters} onFilterChange={setFilters} />

            {/* TABS -- each link keeps the current filters (?search). */}
            <TabScroller ariaLabel="Sales report tabs">
              {salesReportsTabs.map((tab) => {
                const TabIcon = tab.icon;
                return (
                  <NavLink
                    key={tab.path}
                    to={{ pathname: tab.path, search }}
                    className={({ isActive }) =>
                      `button buttonTypeTab textRegular textXS ${
                        isActive ? "active" : ""
                      }`
                    }
                  >
                    <div className="pageTabIcon">
                      <TabIcon size={15} />
                    </div>
                    {tab.label}
                  </NavLink>
                );
              })}
            </TabScroller>

            {isForecast ? (
              <div className="salesReportsForecastNote">
                <p className="textXXS textLight">
                  <GlobeHemisphereEastIcon size={14} /> Company-wide forecast
                  for the fiscal year of the selected period. The salesperson
                  filter doesn&apos;t apply here.
                </p>
                <ExportActions {...exportPdf} />
              </div>
            ) : (
              <SearchFilterBar
                filters={filters}
                onFilterChange={setFilters}
                filterConfig={filterConfig}
                disableSearch
                enableExport
                exportPdf={exportPdf}
              />
            )}

            <div ref={contentRef} className="salesReportsContent">
              {!isForecast && ownerChips.length > 0 && (
                <ActiveFiltersBar
                  filters={ownerChips}
                  setFilters={setFilters}
                  filterConfig={filterConfig}
                  resetParams={() => setFilters({ owner: "" })}
                />
              )}

              <Outlet
                context={{
                  filters,
                  period,
                  access,
                  MappingMissingNote,
                }}
              />
            </div>
          </CardWrapper>
        </div>
      </div>
    </section>
  );
}

// /app/sales/reports -> /app/sales/reports/summary, KEEPING the query string
// (a plain <Navigate to="summary"> would drop the period and salesperson).
export function SalesReportsIndexRedirect() {
  const { search } = useLocation();
  return <Navigate to={{ pathname: "summary", search }} replace />;
}

// Shown by a tab when its RPC reports the selected salesperson has no SAP
// rep mapping: every SAP figure is then (correctly) zero, and this says why.
function MappingMissingNote({ meta }) {
  if (!meta?.mappingMissing) return null;
  return (
    <p className="textXXS textLight" style={{ padding: "0 1rem" }}>
      <WarningCircleIcon size={12} weight="fill" color="#d76363" /> This
      salesperson has no linked SAP sales rep yet — every SAP figure below
      correctly shows zero for them (see Sales Rep Mapping).
    </p>
  );
}
