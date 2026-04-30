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

export default function BarChartRenderer({ data, colorMap }) {
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
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
