// components/payrollCycleFilterBar/PayrollCycleFilterBar.jsx

import Select from "react-select";
import "./PayrollCycleFilterBar.scss";
import { PAYROLL_CYCLE_PRESETS } from "../../functions/payrollCyclePresets";

/**
 * Payroll-cycle (fixed cut-off day, e.g. 26th -> 25th) picker, modeled
 * directly on FiscalYearFilterBar -- writes the same filters.startDate/
 * endDate keys, so it plugs into any page's existing date-range plumbing
 * with zero backend changes. Additive: doesn't replace SearchFilterBar's
 * own calendar-month date-range presets, just adds a payroll-specific one
 * alongside it, same as Sales Reports stacks SearchFilterBar +
 * FiscalYearFilterBar side by side.
 */
export default function PayrollCycleFilterBar({ filters, onFilterChange }) {
  const options = PAYROLL_CYCLE_PRESETS.map((cycle) => ({
    value: cycle.label,
    label: cycle.label,
    getRange: cycle.getRange,
  }));

  // Derived from filters every render (no internal state) so it naturally
  // shows as unselected the moment startDate/endDate diverge from any
  // cycle's exact range -- e.g. the user clicked a SearchFilterBar preset or
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
    <div className="payrollCycleFilterWrapper">
      <p className="textBold textXXS payrollCycleFilterLabel">Payroll Cycle</p>
      <Select
        unstyled
        className="selectContainer"
        classNamePrefix="reactSelect"
        placeholder="Select Payroll Cycle"
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
