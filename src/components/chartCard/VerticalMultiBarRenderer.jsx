import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import CustomTooltip from "./customTooltip/CustomTooltip";
import { useTheme } from "../../context/ThemeContext";
import { compactNumber } from "../../functions/formatNumber";

/**
 * Vertical grouped (not stacked) multi-series bar chart -- mirrors
 * HorizontalMultiBarRenderer's `bars` prop contract, transposed to a
 * standard vertical orientation (categories on the X axis, values on the Y
 * axis). Added 2026-07 for the P&L YoY Trend chart -- a handful of discrete
 * fiscal-year categories reads better as grouped vertical bars than as a
 * many-point line.
 */
export default function VerticalMultiBarRenderer({ data, bars = [] }) {
  const { darkMode } = useTheme();

  const axisColor = darkMode ? "#555" : "#ccc";
  const textColor = darkMode ? "#ececec" : "#666";

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <XAxis
          type="category"
          dataKey="name"
          stroke={axisColor}
          tick={{ fill: textColor, fontSize: 12 }}
          tickLine={false}
        />
        <YAxis
          type="number"
          stroke={axisColor}
          tick={{ fill: textColor, fontSize: 12 }}
          tickLine={false}
          tickFormatter={compactNumber}
        />
        <Tooltip
          cursor={{ fill: "rgba(27, 27, 27, 0.3)" }}
          content={<CustomTooltip darkMode={darkMode} multiBar />}
        />
        <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />

        {bars.map((bar, index) => (
          <Bar
            key={index}
            dataKey={bar.dataKey}
            name={bar.name}
            fill={bar.color}
            barSize={20}
            radius={[4, 4, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
