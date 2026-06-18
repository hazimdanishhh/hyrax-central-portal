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
import CustomLegend from "./customLegend/CustomLegend"; // Assuming you want a legend

export default function VerticalStackedBarRenderer({
  data = [],
  keys = [],
  colorMap = {},
  noLegend = false,
}) {
  const { darkMode } = useTheme();

  const axisColor = darkMode ? "#555" : "#ccc";
  const textColor = darkMode ? "#ececec" : "#666";

  return (
    <>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <XAxis
            dataKey="name"
            stroke={axisColor}
            tick={{ fill: textColor, fontSize: 12 }}
            tickLine={false}
          />
          <YAxis
            stroke={axisColor}
            tick={{ fill: textColor, fontSize: 12 }}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "rgba(27, 27, 27, 0.1)" }}
            content={<CustomTooltip darkMode={darkMode} colorMap={colorMap} />}
          />

          {/* Dynamically render a stacked bar for each key passed in */}
          {keys.map((key, index) => (
            <Bar
              key={key}
              dataKey={key}
              stackId="a" // Sharing the same stackId is what stacks them vertically
              fill={colorMap[key] || "#ccc"}
              barSize={30}
              // Only curve the top corners of the very last bar in the stack array
              radius={index === keys.length - 1 ? [5, 5, 0, 0] : [0, 0, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>

      {!noLegend && (
        <CustomLegend
          data={keys.map((k) => ({ name: k }))}
          colorMap={colorMap}
        />
      )}
    </>
  );
}
