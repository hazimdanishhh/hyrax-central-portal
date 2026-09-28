import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import CustomTooltip from "./customTooltip/CustomTooltip";
import { useTheme } from "../../context/ThemeContext";
import { compactNumber } from "../../functions/formatNumber";

// Opens a chart click-through in a new tab (2026-09-28) -- see the identical
// helper in HorizontalBarChartRenderer.jsx for the full rationale.
function openChartClickThrough(url) {
  if (!url) return;
  window.open(url, "_blank", "noopener,noreferrer");
}

export default function BarChartRenderer({ data, colorMap, onBarClick }) {
  const { darkMode } = useTheme();

  const axisColor = darkMode ? "#555" : "#ccc"; // The line color
  const textColor = darkMode ? "#ececec" : "#666"; // The label text color

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <XAxis
          dataKey="name"
          stroke={axisColor}
          tick={{ fill: textColor, fontSize: 12 }}
          tickLine={false} // Optional: hides the little notches
        />
        <YAxis
          stroke={axisColor}
          tick={{ fill: textColor, fontSize: 12 }}
          tickLine={false}
          tickFormatter={compactNumber}
        />
        <Tooltip
          cursor={{ fill: "rgba(27, 27, 27, 0.3)" }}
          content={<CustomTooltip darkMode={darkMode} barChart />}
        />
        <Bar
          dataKey="value"
          color={colorMap}
          fill={colorMap}
          barSize={20}
          radius={[5, 5, 0, 0]}
          // Per-bar click-through (2026-09-28), same optional/no-op-by-
          // default contract as HorizontalBarChartRenderer's own.
          onClick={
            onBarClick
              ? (entry) => openChartClickThrough(onBarClick(entry))
              : undefined
          }
          cursor={onBarClick ? "pointer" : undefined}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
