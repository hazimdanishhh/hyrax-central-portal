import Button from "../../buttons/button/Button";
import { XIcon } from "@phosphor-icons/react";
import "./ActiveFiltersBar.scss";

/**
 * Active Filters Bar
 * Reusable CRUD Component
 * Shows current active filters
 * Can remove each / all filters
 */
export default function ActiveFiltersBar({
  search,
  setSearch,
  filters,
  setFilters,
  filterConfig,
  resetParams,
}) {
  return (
    <div className="activeFiltersBar">
      <p className="textRegular textXXS">Filters: </p>
      {search && (
        <Button
          style="button filterTag textXXXS"
          name={`Search: ${search}`}
          icon={XIcon}
          size={16}
          onClick={() => setSearch("")}
        />
      )}

      {filters.map(([key, value]) => {
        const filter = filterConfig.find((f) => f.key === key);

        const label = filter?.label || key;

        const optionLabel = filter?.options?.find(
          (opt) => String(opt.value) === String(value),
        )?.label;

        const displayValue = optionLabel || value;

        return (
          <Button
            key={key}
            style="button filterTag textXXXS"
            name={`${label}: ${displayValue}`}
            icon={XIcon}
            size={16}
            onClick={() =>
              setFilters({
                ...Object.fromEntries(filters),
                [key]: "",
              })
            }
          />
        );
      })}

      <Button
        name="Clear All"
        size={16}
        icon={XIcon}
        style="button textXXXS clearAllBtn"
        onClick={resetParams}
      />
    </div>
  );
}
