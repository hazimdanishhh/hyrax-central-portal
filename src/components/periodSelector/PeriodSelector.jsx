// components/periodSelector/PeriodSelector.jsx

import { useState } from "react";
import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react";
import "./PeriodSelector.scss";
import {
  ALL_TIME,
  ALL_TIME_MODE,
  PERIOD_MODES,
  formatPeriod,
  getPeriodMode,
  isCurrentPeriod,
  periodContaining,
  periodToFilters,
  readPeriod,
  stepPeriod,
  todayDateString,
} from "../../functions/periodRange";

/**
 * Report period picker: Month / Quarter / Fiscal Year / Calendar Year, the
 * period's name and exact dates, and ‹ › to step one period at a time.
 * Ported from Echoes Hub's dashboard PeriodSelector.
 *
 * Drop-in replacement for SearchFilterBar's `enableDateRange` controls plus
 * FiscalYearFilterBar: it reads and writes the same filters.startDate/endDate
 * keys, so a page's RPC and drill-through links need no changes. See
 * functions/periodRange.js for the maths and for why the current period of
 * `defaultMode` is written as empty dates.
 *
 * Any range that isn't one whole period (an old bookmark, or one typed under
 * "Custom range") shows as a custom range and steps by its own length.
 *
 * LIST pages (2026-10-27): defaultMode="all" adds an "All time" option and
 * opens on it -- a work list shows everything until a period is picked
 * (DASHBOARD-CONVENTIONS §2a). `caption` names the date being filtered
 * ("Leads created"), so a list never leaves you guessing which date it is.
 */
export default function PeriodSelector({
  filters,
  onFilterChange,
  defaultMode = "month",
  caption,
}) {
  const [customOpen, setCustomOpen] = useState(false);

  const allTimePage = defaultMode === ALL_TIME;
  const modes = allTimePage ? [ALL_TIME_MODE, ...PERIOD_MODES] : PERIOD_MODES;
  const period = readPeriod(filters, defaultMode);
  const isAllTime = period.mode === ALL_TIME;
  const isCustom = period.mode === "custom";
  const showCustom = customOpen || isCustom;
  const modeDef = getPeriodMode(period.mode);
  const { title, range } = formatPeriod(period);
  const isCurrent = !isCustom && !isAllTime && isCurrentPeriod(period);
  const canStep = Boolean(period.startDate && period.endDate);
  const unit = modeDef?.noun ?? "period";

  const write = (next) =>
    onFilterChange({ ...filters, ...periodToFilters(next, defaultMode) });

  // Switching mode keeps your place: the new period is the one containing
  // today if today is inside what you're looking at, otherwise the one
  // containing the start of it. Month view of Sep 2025 -> Fiscal Year gives
  // FY 2025-2026; FY 2024-2025 -> Month gives April 2024.
  function switchTo(mode) {
    setCustomOpen(false);
    if (mode === period.mode) return;
    if (mode === ALL_TIME) {
      write({ mode: ALL_TIME });
      return;
    }
    const anchor =
      isCurrentPeriod(period) || !period.startDate
        ? todayDateString()
        : period.startDate;
    write(periodContaining(mode, anchor));
  }

  // From a custom range: back to the page's default -- this month on a
  // report, all time on a list.
  const backMode = modeDef ? period.mode : defaultMode;
  function backToCurrent() {
    setCustomOpen(false);
    if (backMode === ALL_TIME) {
      write({ mode: ALL_TIME });
      return;
    }
    write(periodContaining(backMode, todayDateString()));
  }
  const backLabel =
    backMode === ALL_TIME ? "Back to all time" : `Back to this ${getPeriodMode(backMode)?.noun ?? "period"}`;

  return (
    <div className="periodSelector">
      {caption && <p className="periodCaption textXXS textLight">{caption}</p>}
      <div className="periodToggle" role="group" aria-label={caption || "Report period"}>
        {modes.map(({ mode, label, shortLabel }) => {
          const active = period.mode === mode;
          return (
            <button
              key={mode}
              type="button"
              aria-pressed={active}
              title={
                mode === "fiscalYear"
                  ? "Fiscal year, April to March"
                  : undefined
              }
              className={`periodToggleButton textXXS ${active ? "active" : ""}`}
              onClick={() => switchTo(mode)}
            >
              <span className="periodLabelLong">{label}</span>
              <span className="periodLabelShort" aria-hidden="true">
                {shortLabel}
              </span>
            </button>
          );
        })}
      </div>

      <div className="periodSwitcher">
        <button
          type="button"
          className="periodSwitcherButton"
          onClick={() => write(stepPeriod(period, -1))}
          disabled={!canStep}
          aria-label={`Previous ${unit}`}
          title={`Previous ${unit}`}
        >
          <CaretLeftIcon size={20} weight="bold" />
        </button>

        <div className="periodSwitcherLabel" aria-live="polite">
          <p className="textS textBold">{title}</p>
          <p className="textXXXS textLight">{range}</p>
          <div className="periodSwitcherLinks textXXXS">
            {isAllTime ? (
              <span className="textLight textS">No date filter</span>
            ) : isCurrent ? (
              <span className="textLight textS">This {unit}</span>
            ) : (
              <button
                type="button"
                className="periodLinkButton"
                onClick={backToCurrent}
              >
                {backLabel}
              </button>
            )}
            {!isCustom && (
              <>
                <span className="textLight" aria-hidden="true">
                  ·
                </span>
                <button
                  type="button"
                  className="periodLinkButton"
                  aria-expanded={customOpen}
                  onClick={() => setCustomOpen((open) => !open)}
                >
                  {customOpen ? "Hide custom range" : "Custom range"}
                </button>
              </>
            )}
          </div>
        </div>

        <button
          type="button"
          className="periodSwitcherButton"
          onClick={() => write(stepPeriod(period, 1))}
          disabled={!canStep}
          aria-label={`Next ${unit}`}
          title={`Next ${unit}`}
        >
          <CaretRightIcon size={20} weight="bold" />
        </button>
      </div>

      {showCustom && (
        <div className="periodCustom">
          <label className="textXXS">
            <span className="textBold">From</span>
            <input
              type="date"
              value={period.startDate}
              onChange={(e) =>
                write({ startDate: e.target.value, endDate: period.endDate })
              }
            />
          </label>
          <label className="textXXS">
            <span className="textBold">To</span>
            <input
              type="date"
              value={period.endDate}
              onChange={(e) =>
                write({ startDate: period.startDate, endDate: e.target.value })
              }
            />
          </label>
        </div>
      )}
    </div>
  );
}
