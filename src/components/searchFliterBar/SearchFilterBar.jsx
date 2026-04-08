// components/searchFilterBar/SearchFilterBar.jsx

import { useState } from "react";
import "./SearchFilterBar.scss";
import { FunnelIcon, MagnifyingGlassIcon } from "@phosphor-icons/react";
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

  return (
    <>
      <div className="searchFilterBar">
        {/* SEARCH */}
        {disableSearch ? null : (
          <div className="searchInputWrapper">
            <MagnifyingGlassIcon size={18} />
            <input
              type="text"
              value={search}
              placeholder={placeholder}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
        )}

        {/* FILTERS */}
        <div className="filterSection">
          <Button
            onClick={() => setFilterOpen(!filterOpen)}
            name="Filter"
            icon2={FunnelIcon}
            style="button buttonType3 textLight textXXS"
          />
        </div>

        {/* DATE RANGE */}
        {enableDateRange && (
          <div className="dateRangeWrapper">
            <input
              type="date"
              value={filters.startDate || ""}
              onChange={(e) =>
                onFilterChange((prev) => ({
                  ...prev,
                  startDate: e.target.value,
                }))
              }
            />

            <span className="textXXS">to</span>

            <input
              type="date"
              value={filters.endDate || ""}
              onChange={(e) =>
                onFilterChange((prev) => ({
                  ...prev,
                  endDate: e.target.value,
                }))
              }
            />
          </div>
        )}
      </div>

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
                  onFilterChange((prev) => ({
                    ...prev,
                    [filter.key]: e.target.value,
                  }))
                }
              >
                <option value="">{filter.label}</option>
                {filter.options.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
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
