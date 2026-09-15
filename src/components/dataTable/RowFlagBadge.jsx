import { WarningCircleIcon } from "@phosphor-icons/react";
import Tooltip from "@/components/tooltip/Tooltip";
import "./RowFlagBadge.scss";

/**
 * Generic per-row flag indicator for DataTable's flag column -- only the
 * exception is visually noisy; a row with no items renders nothing.
 * Hovering lists each item, so "what's wrong with this row" is visible
 * without opening it. Originally built for Employee Management's "missing
 * required fields" (see getMissingFields.js, still DataTable's default via
 * `showCompleteness`), generalized so any page can supply its own
 * `getRowFlags(row, columns) => string[]` rule instead (e.g. Payroll
 * Export's "needs reconciliation").
 */
export default function RowFlagBadge({ items, icon, tooltipTitle = "Flagged" }) {
  if (!items || items.length === 0) return null;

  const Icon = icon ?? WarningCircleIcon;

  return (
    <Tooltip
      content={
        <div className="rowFlagBadgeTooltip">
          <p className="textBold textXXS">{tooltipTitle}</p>
          {items.map((label) => (
            <p key={label} className="textXXS">
              {label}
            </p>
          ))}
        </div>
      }
    >
      <span className="rowFlagBadge textXXS" tabIndex={0}>
        <Icon size={14} weight="fill" />
        {items.length}
      </span>
    </Tooltip>
  );
}
