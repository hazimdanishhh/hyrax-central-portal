import Button from "../../buttons/button/Button";
import { XIcon } from "@phosphor-icons/react";
import "./ActiveFiltersBar.scss";

export default function ActiveFiltersBar({
  search,
  setSearch,
  filters,
  setFilters,
  filterConfig,
}) {
  return (
    <div className="activeFiltersBar">
      <p className="textRegular textXXS">Filters: </p>
      {search && (
        <Button
          style="button filterTag textXXXS"
          name={`Search: ${search}`}
          icon={XIcon}
          onClick={() => setSearch("")}
        />
      )}

      {filters.map(([key, value]) => {
        const filter = filterConfig.find((f) => f.key === key);
        const label = filter?.label || key;

        return (
          <Button
            key={key}
            style="button filterTag textXXXS"
            name={`${label}: ${value}`}
            icon={XIcon}
            onClick={() =>
              setFilters((prev) => ({
                ...prev,
                [key]: "",
              }))
            }
          />
        );
      })}

      <Button
        name="Clear All"
        icon={XIcon}
        style="button textXXXS clearAllBtn"
        onClick={() => {
          setSearch("");
          setFilters({});
        }}
      />
    </div>
  );
}
