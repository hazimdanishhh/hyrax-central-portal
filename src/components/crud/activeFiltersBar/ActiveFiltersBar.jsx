import Button from "../../buttons/button/Button";
import { XIcon } from "@phosphor-icons/react";
import "./ActiveFiltersBar.scss";
import { useEffect, useState } from "react";

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
  const [asyncLabels, setAsyncLabels] = useState({});

  useEffect(() => {
    async function loadLabels() {
      const resolved = {};

      for (const [key, value] of filters) {
        const filter = filterConfig.find((f) => f.key === key);

        if (filter?.editor === "asyncSelect" && filter.getDisplayValue) {
          resolved[key] = await filter.getDisplayValue(value);
        }
      }

      setAsyncLabels(resolved);
    }

    loadLabels();
  }, [filters, filterConfig]);
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

        // Multi-select filters (2026-09-28) store a comma-joined value --
        // no single option's value equals the whole string, so the label
        // lookup below has to happen per-value instead of once.
        const optionLabel = filter?.multi
          ? String(value)
              .split(",")
              .map(
                (v) =>
                  filter?.options?.find((opt) => String(opt.value) === v)
                    ?.label || v,
              )
              .join(", ")
          : filter?.options?.find((opt) => String(opt.value) === String(value))
              ?.label;

        const displayValue = optionLabel || asyncLabels[key] || value;

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
