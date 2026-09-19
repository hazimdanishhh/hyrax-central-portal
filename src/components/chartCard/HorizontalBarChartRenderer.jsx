import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import CustomTooltip from "./customTooltip/CustomTooltip";
import CustomYAxisTick from "./CustomYAxisTick";
import { useTheme } from "../../context/ThemeContext";
import { compactNumber } from "../../functions/formatNumber";

export default function HorizontalBarChartRenderer({ data, colorMap, onBarClick }) {
  const { darkMode } = useTheme();

  const axisColor = darkMode ? "#555" : "#ccc";
  const textColor = darkMode ? "#ececec" : "#666";

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={data}
        layout="vertical" // Crucial for horizontal rendering
        margin={{ top: 5, right: 20, left: 40, bottom: 5 }} // Extra left margin for long names
      >
        <XAxis
          type="number"
          stroke={axisColor}
          tick={{ fill: textColor, fontSize: 12 }}
          tickLine={false}
          tickFormatter={compactNumber}
        />
        <YAxis
          type="category"
          dataKey="name"
          stroke={axisColor}
          tick={(props) => (
            <CustomYAxisTick {...props} fill={textColor} fontSize={12} />
          )}
          tickLine={false}
          width={100}
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
          radius={[0, 5, 5, 0]} // Rounded corners on the right side
          // Per-bar click-through (added 2026-09, Operating Expense
          // Breakdown's own drill-down into Account Ledger) -- optional, a
          // no-op cursor/handler for every other chart using this renderer
          // that doesn't pass it. Recharts' own onClick natively receives
          // the full data-point object each Bar rectangle was drawn from.
          onClick={onBarClick ? (entry) => onBarClick(entry) : undefined}
          cursor={onBarClick ? "pointer" : undefined}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
