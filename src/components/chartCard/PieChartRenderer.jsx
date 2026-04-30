import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { CHART_PALETTE } from "./chartColors";
import CustomTooltip from "./customTooltip/CustomTooltip";
import { useTheme } from "../../context/ThemeContext";
import CustomLegend from "./customLegend/CustomLegend";

// Map colors by name
function getColorByKey(key, colors) {
  let hash = 0;

  for (let i = 0; i < key.length; i++) {
    hash = key.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash % colors.length)];
}

function getPieColor(entry, mode, colorMap, colors) {
  if (mode === "semantic") {
    return colorMap[entry.name] || "#696969";
  }

  let hash = 0;

  for (let i = 0; i < entry.name.length; i++) {
    hash = entry.name.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash % colors.length)];
}

export default function PieChartRenderer({
  data,
  mode = "exploratory", // 👈 IMPORTANT
  colorMap = {},
  colors = CHART_PALETTE,
  innerRadius = 60,
  outerRadius = 100,
  centerLabel,
  centerSubLabel,
  showLegend = true,
}) {
  const total = data?.reduce((sum, d) => sum + d.value, 0) || 0;
  const { darkMode } = useTheme();

  return (
    <>
      <ResponsiveContainer width="100%" height={320}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            label
          >
            {data?.map((entry) => {
              let fill;

              if (mode === "semantic") {
                fill = colorMap[entry.name] || "#696969"; // fallback neutral
              } else {
                fill = getColorByKey(entry.name, colors);
              }

              return <Cell key={entry.name} fill={fill} />;
            })}
          </Pie>

          <Tooltip
            cursor={{ fill: "transparent" }}
            content={<CustomTooltip darkMode={darkMode} colorMap={colorMap} />}
          />

          {centerLabel && (
            <>
              <text
                x="50%"
                y="45%"
                textAnchor="middle"
                dominantBaseline="middle"
                className="textXL textBold"
                style={{ fill: "currentColor " }}
              >
                {centerLabel === "total" ? total : centerLabel}
              </text>

              {centerSubLabel && (
                <text
                  x="50%"
                  y="53%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="textXXS textLight"
                  style={{ fill: "currentColor " }}
                >
                  {centerSubLabel}
                </text>
              )}
            </>
          )}
        </PieChart>
      </ResponsiveContainer>

      {/* LEGEND */}
      {showLegend && (
        <CustomLegend
          data={data}
          colorMap={colorMap}
          mode={mode}
          colors={colors}
        />
      )}
    </>
  );
}
