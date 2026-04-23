import { ArrowDownIcon, ArrowUpIcon } from "@phosphor-icons/react";
import Button from "../../buttons/button/Button";
import CardLayout from "../../cardLayout/CardLayout";
import "./SortBar.scss";

function SortBar({ sortBy, setSortBy, sortOptions, sortOrder, setSortOrder }) {
  return (
    <CardLayout style="cardLayoutFlex cardGapMedium cardLayoutNoPadding">
      {/* SORT DROPDOWN */}
      <select
        value={sortBy}
        onChange={(e) => setSortBy(e.target.value)}
        className="sortDropdown"
      >
        {sortOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            Sort by: {opt.label}
          </option>
        ))}
      </select>

      {/* ORDER TOGGLE */}
      <Button
        onClick={() =>
          setSortOrder(sortOrder === "ascending" ? "descending" : "ascending")
        }
        icon={sortOrder === "ascending" ? ArrowUpIcon : ArrowDownIcon}
        size={16}
        style="button buttonType5 textRegular textXXXS"
        name={sortOrder === "ascending" ? "Ascending" : "Descending"}
      />
    </CardLayout>
  );
}

export default SortBar;
