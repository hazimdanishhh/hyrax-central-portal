import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useTheme } from "../../context/ThemeContext";
import CustomLegend from "./customLegend/CustomLegend";
import CustomTooltip from "./customTooltip/CustomTooltip";

export default function StackedBarRenderer({
  data = [],
  colorMap = {},
  height = 20,
  noLegend = false,
}) {
  const { darkMode } = useTheme();

  const chartData = [
    data.reduce(
      (acc, curr) => {
        acc[curr.name] = curr.value;
        return acc;
      },
      { name: "total" },
    ),
  ];

  return (
    <>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chartData} layout="vertical">
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" hide />
          {data.map((entry) => (
            <Bar
              key={entry.name}
              dataKey={entry.name}
              stackId="a"
              fill={colorMap[entry.name] || "#ccc"}
              barSize={10}
              radius={[10, 10, 10, 10]}
            />
          ))}
          {/* 3. Pass the custom component to the content prop */}
          <Tooltip
            cursor={{ fill: "transparent" }}
            content={<CustomTooltip darkMode={darkMode} colorMap={colorMap} />}
          />
        </BarChart>
      </ResponsiveContainer>
      {!noLegend && <CustomLegend data={data} colorMap={colorMap} />}
    </>
  );
}
