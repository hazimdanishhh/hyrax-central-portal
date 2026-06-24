import "./CustomTooltip.scss";

export default function CustomTooltip({
  active,
  payload,
  label,
  darkMode,
  colorMap = {},
  barChart,
  multiBar,
}) {
  if (active && payload && payload.length) {
    return (
      <div
        className={
          darkMode
            ? "customTooltipContainer sectionDark"
            : "customTooltipContainer sectionLight"
        }
      >
        {multiBar && label && (
          <div className="textBold mb-1" style={{ marginBottom: "4px" }}>
            {label}
          </div>
        )}

        {payload.map((entry) => {
          const color =
            entry.color ||
            entry.fill ||
            entry.stroke ||
            colorMap[entry.dataKey] ||
            colorMap[entry.name];

          // NEW LOGIC: If multiBar, use the bar's name. Otherwise fallback to old logic.
          const displayLabel = multiBar
            ? entry.name
            : barChart
              ? label
              : entry.name;

          return (
            <div key={entry.name} className="tooltipEntryContainer textXXXS">
              <span
                style={{ backgroundColor: color }}
                className="tooltipEntryCircle"
              />
              <span className="textBold">{displayLabel}:</span>
              <span>{entry.value}</span>
            </div>
          );
        })}
      </div>
    );
  }

  return null;
}
