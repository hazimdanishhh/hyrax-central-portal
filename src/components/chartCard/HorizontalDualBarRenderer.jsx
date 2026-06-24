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

export default function HorizontalDualBarRenderer({
  data,
  key1,
  key2,
  color1,
  color2,
  label1,
  label2,
}) {
  const { darkMode } = useTheme();

  const axisColor = darkMode ? "#555" : "#ccc";
  const textColor = darkMode ? "#ececec" : "#666";

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 5, right: 20, left: 40, bottom: 5 }}
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
          width={100}
        />
        <Tooltip
          cursor={{ fill: "rgba(27, 27, 27, 0.3)" }}
          content={<CustomTooltip darkMode={darkMode} multiBar />} // CHANGED THIS LINE
        />
        <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />

        {/* The two grouped bars */}
        <Bar
          dataKey={key1}
          name={label1}
          fill={color1}
          barSize={12}
          radius={[0, 4, 4, 0]}
        />
        <Bar
          dataKey={key2}
          name={label2}
          fill={color2}
          barSize={12}
          radius={[0, 4, 4, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
