// components/searchFilterBar/SearchFilterBar.jsx

import { useEffect, useState } from "react";
import "./SearchFilterBar.scss";
import {
  CaretDownIcon,
  CaretLeftIcon,
  CaretRightIcon,
  CaretUpIcon,
  DownloadSimpleIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  XIcon,
} from "@phosphor-icons/react";
import Button from "../buttons/button/Button";
import { useTheme } from "../../context/ThemeContext";
import { AnimatePresence, motion } from "framer-motion";
import Select from "react-select";
import CardLayout from "../cardLayout/CardLayout";
import AsyncSelectEditor from "../dataTable/editors/AsyncSelectEditor";
import CsvExportButton from "../exportActions/CsvExportButton";
import ExportFullReport from "../exportActions/ExportFullReport";
import { DATE_RANGE_PRESETS } from "../../functions/dateRangePresets";

// Plain calendar-day arithmetic, same convention as
// useAttendanceDailyList.js's shiftDate -- no date library in this repo.
function pad(n) {
  return String(n).padStart(2, "0");
}

function toDateString(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseDateString(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function isFirstOfMonth(d) {
  return d.getDate() === 1;
}

// Rolling forward one day lands in the next month iff d was that month's
// last day -- avoids hardcoding month lengths/leap years.
function isLastOfMonth(d) {
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  return next.getDate() === 1;
}

function monthsBetweenInclusive(start, end) {
  return (
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth()) +
    1
  );
}

// Shifts the WHOLE range by its own length, like the Attendance
// day-navigator but for a range instead of a single day. A whole-calendar-
// month range (1st of a month through the last day of a month, possibly
// spanning several consecutive months) shifts by MONTHS via setMonth, so
// e.g. May shifted back lands on the whole of April (Apr 1-30), not "31
// days earlier" (which would drift into March because April is shorter
// than May). Any other range (partial months, weeks, arbitrary custom
// ranges) shifts by a fixed day count, which is already correct for those.
function shiftDateRange(startDate, endDate, direction) {
  const start = parseDateString(startDate);
  const end = parseDateString(endDate);

  if (isFirstOfMonth(start) && isLastOfMonth(end)) {
    const monthSpan = monthsBetweenInclusive(start, end);
    const newStart = new Date(
      start.getFullYear(),
      start.getMonth() + direction * monthSpan,
      1,
    );
    const newEnd = new Date(
      newStart.getFullYear(),
      newStart.getMonth() + monthSpan,
      0, // day 0 = last day of the previous month
    );

    return { startDate: toDateString(newStart), endDate: toDateString(newEnd) };
  }

  const spanDays = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;

  start.setDate(start.getDate() + direction * spanDays);
  end.setDate(end.getDate() + direction * spanDays);

  return { startDate: toDateString(start), endDate: toDateString(end) };
}

export default function SearchFilterBar({
  search,
  onSearchChange,
  filters,
  onFilterChange,
  filterConfig = [],
  placeholder = "Search...",
  enableDateRange,
  disableSearch,

  // NEW
  enableExport,
  exportFetchFn,
  exportColumns,
  exportFileNamePrefix,
  sortBy,
  sortOrder,
  isLoading,
  isError,
  dashboardRef,
}) {
  const { darkMode } = useTheme();
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchInput, setSearchInput] = useState(search || "");
  const [asyncValues, setAsyncValues] = useState({});
  const [exportIsOpen, setExportIsOpen] = useState(false);

  useEffect(() => {
    setSearchInput(search || "");
  }, [search]);

  useEffect(() => {
    async function loadAsyncValues() {
      const resolved = {};

      for (const filter of filterConfig) {
        if (filter.editor === "asyncSelect" && filters[filter.key]) {
          resolved[filter.key] = await filter.getOptionByValue?.(
            filters[filter.key],
          );
        }
      }

      setAsyncValues(resolved);
    }

    loadAsyncValues();
  }, [filters, filterConfig]);

  const canShiftRange = Boolean(filters.startDate && filters.endDate);

  function handleShiftRange(direction) {
    if (!canShiftRange) return;

    onFilterChange({
      ...filters,
      ...shiftDateRange(filters.startDate, filters.endDate, direction),
    });
  }

  return (
    <>
      <div className="searchFilterBar">
        {/* SEARCH */}
        {disableSearch ? null : (
          <div className="searchInputWrapper">
            <input
              type="text"
              value={searchInput}
              placeholder={placeholder}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onSearchChange(e.target.value); // trigger actual search on Enter
                }
              }}
            />
            {searchInput.length !== 0 && (
              <Button
                onClick={() => {
                  setSearchInput("");
                  onSearchChange("");
                }}
                icon={XIcon}
                size={18}
                style="iconButton2"
              />
            )}
            <Button
              onClick={() => onSearchChange(searchInput)}
              icon={MagnifyingGlassIcon}
              size={18}
              style="iconButton2"
            />
          </div>
        )}

        {/* FILTERS */}
        <div className="filterSection">
          <Button
            onClick={() => setFilterOpen(!filterOpen)}
            name="Filter"
            icon2={FunnelIcon}
            style="button buttonType5 textLight textXXS"
          />
        </div>

        {/* EXPORT BUTTON */}
        {enableExport && (
          <div className="exportSectionContainer">
            <Button
              name="Export"
              icon={exportIsOpen === true ? CaretUpIcon : CaretDownIcon}
              icon2={DownloadSimpleIcon}
              style="textXXS button buttonType5 blue"
              size={20}
              onClick={() => setExportIsOpen(!exportIsOpen)}
            />
            {exportIsOpen && (
              <div
                className={
                  darkMode
                    ? "sectionDark exportSection"
                    : "sectionLight exportSection"
                }
              >
                {exportFetchFn && exportColumns && (
                  <CsvExportButton
                    fetchFn={exportFetchFn}
                    columns={exportColumns}
                    fileNamePrefix={exportFileNamePrefix}
                    search={search}
                    filters={filters}
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                  />
                )}
                {dashboardRef && (
                  <ExportFullReport
                    targetRef={dashboardRef}
                    search={search}
                    filters={filters}
                    fileName="Sales_Leads_Report"
                    reportTitle="Sales Leads Report"
                    logoUrl="/logos/logo.png"
                    subtitle={`Filters Applied: ${
                      filters.startDate && filters.endDate
                        ? `${filters.startDate} to ${filters.endDate}`
                        : "All Time"
                    }`}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* DATE SELECTOR - This month, This quarter, etc. */}
      {enableDateRange && (
        <div className="dateRangePresets">
          {DATE_RANGE_PRESETS.map((preset) => (
            <Button
              key={preset.label}
              name={preset.label}
              style="textXXS button buttonType4"
              onClick={() =>
                onFilterChange({ ...filters, ...preset.getRange() })
              }
            />
          ))}
        </div>
      )}

      {/* DATE RANGE */}
      {enableDateRange && (
        <div className="dateRangeWrapper">
          <p className="textBold textXXS dateRangeLable">Date Range</p>

          <div className="dateRangeInputContainer">
            <Button
              size={16}
              icon={CaretLeftIcon}
              style="iconButton2 textXXS"
              title="Previous Period"
              disabled={!canShiftRange}
              onClick={() => handleShiftRange(-1)}
            />

            <input
              type="date"
              value={filters.startDate || ""}
              onChange={(e) =>
                onFilterChange({
                  ...filters,
                  startDate: e.target.value,
                })
              }
            />

            <span className="textXXS">to</span>

            <input
              type="date"
              value={filters.endDate || ""}
              onChange={(e) =>
                onFilterChange({
                  ...filters,
                  endDate: e.target.value,
                })
              }
            />

            <Button
              size={16}
              icon={CaretRightIcon}
              style="iconButton2 textXXS"
              title="Next Period"
              disabled={!canShiftRange}
              onClick={() => handleShiftRange(1)}
            />
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        {filterOpen && (
          <motion.div
            className="filterContainer searchFilterBar"
            initial={{ opacity: 0, height: 0, y: -5 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: -5 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            {filterConfig.map((filter) => (
              <div className="filterSelectContainer" key={filter.key}>
                <p className="filterSelectLabel textBold textXXS">
                  {filter.label}
                </p>

                {filter.editor === "asyncSelect" ? (
                  <AsyncSelectEditor
                    placeholder={`Search ${filter.label}`}
                    loadOptions={filter.loadOptions}
                    value={asyncValues[filter.key] || null}
                    onChange={(selectedOption) =>
                      onFilterChange({
                        ...filters,
                        [filter.key]: selectedOption
                          ? selectedOption.value
                          : "",
                      })
                    }
                  />
                ) : (
                  <Select
                    unstyled
                    className="selectContainer"
                    classNamePrefix="reactSelect"
                    placeholder={`Select ${filter.label}`}
                    isClearable
                    isSearchable
                    options={
                      typeof filter.options === "function"
                        ? filter.options(filters)
                        : filter.options
                    }
                    value={
                      filter.options.find(
                        (opt) =>
                          String(opt.value) === String(filters[filter.key]),
                      ) || null
                    }
                    onChange={(selectedOption) =>
                      onFilterChange({
                        ...filters,
                        [filter.key]: selectedOption
                          ? selectedOption.value
                          : "",
                      })
                    }
                  />
                )}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
