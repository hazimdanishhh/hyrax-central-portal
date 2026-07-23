// components/fiscalYearFilterBar/FiscalYearFilterBar.jsx

import Select from "react-select";
import "./FiscalYearFilterBar.scss";
import { FISCAL_YEAR_PRESETS } from "../../functions/fiscalYearPresets";

/**
 * Fiscal-year (April -> March) picker, modeled on SearchFilterBar's
 * date-range presets -- writes the same filters.startDate/endDate keys, so
 * it plugs into any page's existing date-range plumbing with zero backend
 * changes. Additive: doesn't replace SearchFilterBar's own date controls.
 */
export default function FiscalYearFilterBar({ filters, onFilterChange }) {
  const options = FISCAL_YEAR_PRESETS.map((fy) => ({
    value: fy.label,
    label: fy.label,
    getRange: fy.getRange,
  }));

  // Derived from filters every render (no internal state) so it naturally
  // shows as unselected the moment startDate/endDate diverge from any FY's
  // exact range -- e.g. the user clicked a DATE_RANGE_PRESETS button or
  // edited the native date inputs directly.
  const selected =
    options.find((opt) => {
      const range = opt.getRange();

      return (
        filters?.startDate === range.startDate &&
        filters?.endDate === range.endDate
      );
    }) || null;

  return (
    <div className="fiscalYearFilterWrapper">
      <p className="textBold textXXS fiscalYearFilterLabel">Fiscal Year</p>
      <Select
        unstyled
        className="selectContainer"
        classNamePrefix="reactSelect"
        placeholder="Select Fiscal Year"
        isClearable
        isSearchable={false}
        options={options}
        value={selected}
        onChange={(option) =>
          onFilterChange({
            ...filters,
            ...(option ? option.getRange() : { startDate: "", endDate: "" }),
          })
        }
      />
    </div>
  );
}
