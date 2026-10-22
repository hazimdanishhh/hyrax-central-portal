// components/periodSelector/PeriodSelector.jsx

import { useState } from "react";
import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react";
import "./PeriodSelector.scss";
import {
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
 */
export default function PeriodSelector({
  filters,
  onFilterChange,
  defaultMode = "month",
}) {
  const [customOpen, setCustomOpen] = useState(false);

  const period = readPeriod(filters, defaultMode);
  const isCustom = period.mode === "custom";
  const showCustom = customOpen || isCustom;
  const modeDef = getPeriodMode(period.mode);
  const { title, range } = formatPeriod(period);
  const isCurrent = !isCustom && isCurrentPeriod(period);
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
    const anchor =
      isCurrentPeriod(period) || !period.startDate
        ? todayDateString()
        : period.startDate;
    write(periodContaining(mode, anchor));
  }

  function backToCurrent() {
    setCustomOpen(false);
    const mode = modeDef ? period.mode : defaultMode;
    write(periodContaining(mode, todayDateString()));
  }

  return (
    <div className="periodSelector">
      <div className="periodToggle" role="group" aria-label="Report period">
        {PERIOD_MODES.map(({ mode, label, shortLabel }) => {
          const active = period.mode === mode;
          return (
            <button
              key={mode}
              type="button"
              aria-pressed={active}
              title={mode === "fiscalYear" ? "Fiscal year, April to March" : undefined}
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
            {isCurrent ? (
              <span className="textLight">This {unit}</span>
            ) : (
              <button type="button" className="periodLinkButton" onClick={backToCurrent}>
                Back to this {modeDef ? unit : getPeriodMode(defaultMode).noun}
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
