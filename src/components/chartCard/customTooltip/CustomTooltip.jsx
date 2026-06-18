import "./CustomTooltip.scss";

export default function CustomTooltip({
  active,
  payload,
  label,
  darkMode,
  colorMap = {},
  barChart,
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
        {payload.map((entry) => {
          // 1. LineCharts use `entry.color` or `entry.stroke`
          // 2. BarCharts use `entry.fill`
          // 3. Fallback to the passed colorMap using dataKey or name
          const color =
            entry.color ||
            entry.fill ||
            entry.stroke ||
            colorMap[entry.dataKey] ||
            colorMap[entry.name];

          return (
            <div key={entry.name} className="tooltipEntryContainer textXXXS">
              <span
                style={{ backgroundColor: color }}
                className="tooltipEntryCircle"
              />
              <span className="textBold">{barChart ? label : entry.name}:</span>
              <span>{entry.value}</span>
            </div>
          );
        })}
      </div>
    );
  }

  return null;
}
