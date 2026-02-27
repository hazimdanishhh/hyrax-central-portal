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
      {search && (
        <div className="filterTag textXXXS">
          <span>
            <strong>Search: </strong>
            {search}
          </span>
          <Button onClick={() => setSearch("")} icon={XIcon} />
        </div>
      )}

      {filters.map(([key, value]) => {
        const filter = filterConfig.find((f) => f.key === key);
        const label = filter?.label || key;

        return (
          <div key={key} className="filterTag textXXXS">
            <span>
              <strong>{label}: </strong>
              {value}
            </span>
            <Button
              onClick={() =>
                setFilters((prev) => ({
                  ...prev,
                  [key]: "",
                }))
              }
              icon={XIcon}
            />
          </div>
        );
      })}

      <Button
        name="Clear All"
        icon={XIcon}
        style="button buttonTypeDelete2 textXXXS clearAllBtn"
        onClick={() => {
          setSearch("");
          setFilters({});
        }}
      />
    </div>
  );
}
