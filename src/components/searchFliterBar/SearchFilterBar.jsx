// components/searchFilterBar/SearchFilterBar.jsx

import { useEffect, useState } from "react";
import "./SearchFilterBar.scss";
import { FunnelIcon, MagnifyingGlassIcon, XIcon } from "@phosphor-icons/react";
import Button from "../buttons/button/Button";
import { useTheme } from "../../context/ThemeContext";
import { AnimatePresence, motion } from "framer-motion";

export default function SearchFilterBar({
  search,
  onSearchChange,
  filters,
  onFilterChange,
  filterConfig = [],
  placeholder = "Search...",
  enableDateRange,
  disableSearch,
}) {
  const { darkMode } = useTheme();
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchInput, setSearchInput] = useState(search || "");

  useEffect(() => {
    setSearchInput(search || "");
  }, [search]);

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
      </div>

      {/* DATE RANGE */}
      {enableDateRange && (
        <div className="dateRangeWrapper">
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
              <select
                key={filter.key}
                value={filters[filter.key] || ""}
                onChange={(e) =>
                  onFilterChange({
                    ...filters,
                    [filter.key]: e.target.value === "" ? "" : e.target.value,
                  })
                }
              >
                <option value="">{filter.label}</option>
                {filter.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
