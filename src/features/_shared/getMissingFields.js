import { isFilled } from "./isFilled";
import { resolveColumnValue } from "./resolveColumnValue";

/**
 * Any column marked `required: true` (and not `computed`, e.g. a query-time
 * embed like lifecycle_cases) that resolves to an empty value is "missing".
 * Deliberately broader than the HR dashboard's own "no manager/department/
 * profile" Data Gaps KPI (get_hr_employees_dashboard_rpc.sql/
 * overviewConfig.js) -- that KPI stays as-is and unrelated. Pure and
 * page-agnostic: works for any page's tableConfig.jsx column array.
 */
export function getMissingFields(row, columns) {
  return columns
    .filter((col) => col.required && !col.computed)
    .filter((col) => !isFilled(resolveColumnValue(row, col)))
    .map((col) => col.label);
}
