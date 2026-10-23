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

// Opens a chart click-through in a new tab (2026-09-25) -- see the identical
// helper in HorizontalBarChartRenderer.jsx for the full rationale (one
// change here/there/LineChartRenderer.jsx updates every chart using these
// renderers, instead of duplicating the decision per dashboard page).
function openChartClickThrough(url) {
  if (!url) return;
  window.open(url, "_blank", "noopener,noreferrer");
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
  // Per-slice click-through (added 2026-09-25, Attendance Overview chart
  // restructuring pass -- extends the onBarClick convention
  // HorizontalBarChartRenderer/VerticalMultiBarRenderer already established)
  // -- optional, a no-op for every other chart using this renderer that
  // doesn't pass it. Recharts' own onClick natively receives the full
  // data-point object each slice was drawn from.
  onSliceClick,
  // Number formatting (2026-10-23), all optional -- leaving them out keeps
  // the original plain-number look:
  //   valueFormatter   tooltip and legend values (full precision)
  //   centerFormatter  the "total" in the middle (it has to fit the hole,
  //                    so a compact form, e.g. compactCurrency)
  //   sliceLabel       what sits beside each slice: "value" (default),
  //                    "percent", or false for none
  valueFormatter,
  centerFormatter,
  sliceLabel = "value",
}) {
  // Number(): a value arriving as a string would otherwise concatenate.
  const total = data?.reduce((sum, d) => sum + Number(d.value || 0), 0) || 0;
  const { darkMode } = useTheme();

  const pieLabel =
    sliceLabel === "percent"
      ? ({ percent }) => `${Math.round(percent * 100)}%`
      : sliceLabel === "value"
        ? valueFormatter
          ? ({ value }) => valueFormatter(value)
          : true
        : false;
  const centerText =
    centerLabel === "total"
      ? (centerFormatter ?? valueFormatter ?? ((v) => v))(total)
      : centerLabel;

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
            label={pieLabel}
            onClick={
              onSliceClick
                ? (entry) => openChartClickThrough(onSliceClick(entry))
                : undefined
            }
          >
            {data?.map((entry) => {
              let fill;

              if (mode === "semantic") {
                fill = colorMap[entry.name] || "#696969"; // fallback neutral
              } else {
                fill = getColorByKey(entry.name, colors);
              }

              return (
                <Cell
                  key={entry.name}
                  fill={fill}
                  cursor={onSliceClick ? "pointer" : undefined}
                />
              );
            })}
          </Pie>

          <Tooltip
            cursor={{ fill: "transparent" }}
            content={
              <CustomTooltip
                darkMode={darkMode}
                colorMap={colorMap}
                valueFormatter={valueFormatter}
              />
            }
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
                {centerText}
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
          valueFormatter={valueFormatter}
          mode={mode}
          colors={colors}
        />
      )}
    </>
  );
}
