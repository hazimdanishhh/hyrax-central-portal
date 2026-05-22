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

export default function LineChartRenderer({
  data = [],
  lines = [],
  height = 320,
  showGrid = true,
  showLegend = true,
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
        />

        <Tooltip
          cursor={{
            stroke: "rgba(120,120,120,0.35)",
            strokeWidth: 1,
          }}
          content={<CustomTooltip darkMode={darkMode} colorMap={colorMap} />}
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
            }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
