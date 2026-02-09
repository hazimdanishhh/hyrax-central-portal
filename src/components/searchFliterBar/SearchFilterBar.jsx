import "./SearchFilterBar.scss";
import { MagnifyingGlass } from "phosphor-react";

export default function SearchFilterBar({
  search,
  onSearchChange,
  filters,
  onFilterChange,
  filterConfig = [],
  placeholder = "Search...",
}) {
  return (
    <div className="searchFilterBar">
      {/* SEARCH */}
      <div className="searchInputWrapper">
        <MagnifyingGlass size={18} />
        <input
          type="text"
          value={search}
          placeholder={placeholder}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      {/* FILTERS */}
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
    </div>
  );
}
