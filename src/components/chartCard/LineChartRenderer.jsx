// components/chartCard/LineChartRenderer.jsx

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

import { useTheme } from "../../context/ThemeContext";
import CustomTooltip from "./customTooltip/CustomTooltip";
import { compactNumber } from "../../functions/formatNumber";

// Opens a chart click-through in a new tab (2026-09-25) -- see the identical
// helper in HorizontalBarChartRenderer.jsx for the full rationale.
function openChartClickThrough(url) {
  if (!url) return;
  window.open(url, "_blank", "noopener,noreferrer");
}

export default function LineChartRenderer({
  data = [],
  lines = [],
  height = 320,
  showGrid = true,
  showLegend = true,
  // Per-point click-through (added 2026-09-25, Attendance Overview chart
  // restructuring pass -- extends the onBarClick/onSliceClick convention).
  // A clicked point represents a bucketed period (day/week/month), not a
  // single filterable category the way a bar/slice is -- the caller is
  // expected to turn the point's own `payload` (which carries whatever date/
  // period key the data was built with) into a startDate/endDate filter
  // sized to that bucket, not reuse the bar/pie filter shape as-is.
  onPointClick,
}) {
  const { darkMode } = useTheme();

  const axisColor = darkMode ? "#555" : "#ccc";
  const textColor = darkMode ? "#ececec" : "#666";

  // Convert lines -> colorMap
  const colorMap = lines.reduce((acc, line) => {
    acc[line.dataKey] = line.color;
    return acc;
  }, {});

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data}>
        {showGrid && (
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={axisColor}
            opacity={darkMode ? 0.15 : 0.3}
          />
        )}

        <XAxis
          dataKey="name"
          stroke={axisColor}
          tick={{ fill: textColor, fontSize: 12 }}
          tickLine={false}
        />

        <YAxis
          allowDecimals={false}
          stroke={axisColor}
          tick={{ fill: textColor, fontSize: 12 }}
          tickLine={false}
          tickFormatter={compactNumber}
        />

        <Tooltip
          cursor={{
            stroke: "rgba(120,120,120,0.35)",
            strokeWidth: 1,
          }}
          content={
            <CustomTooltip darkMode={darkMode} colorMap={colorMap} multiBar />
          }
        />

        {showLegend && (
          <Legend
            wrapperStyle={{
              fontSize: 12,
              color: textColor,
            }}
          />
        )}

        {lines.map((line) => (
          <Line
            key={line.dataKey}
            type="monotone"
            dataKey={line.dataKey}
            stroke={line.color}
            strokeWidth={3}
            dot={{
              r: 3,
              fill: line.color,
              strokeWidth: 0,
            }}
            activeDot={{
              r: 6,
              fill: line.color,
              cursor: onPointClick ? "pointer" : undefined,
              onClick: onPointClick
                ? (props) =>
                    openChartClickThrough(onPointClick(props.payload, line))
                : undefined,
            }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
