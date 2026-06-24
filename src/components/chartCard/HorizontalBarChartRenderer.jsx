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

export default function HorizontalBarChartRenderer({ data, colorMap }) {
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
        />
        <YAxis
          type="category"
          dataKey="name"
          stroke={axisColor}
          tick={{ fill: textColor, fontSize: 12 }}
          tickLine={false}
          width={100} // Ensures text labels aren't truncated
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
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
