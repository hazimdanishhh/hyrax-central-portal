import "./CustomTooltip.scss";

export default function CustomTooltip({
  active,
  payload,
  label,
  darkMode,
  colorMap,
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
          // Recharts passes the original color down as entry.fill
          const color = entry.fill || colorMap[entry.name];

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
}
