// components/chartCard/BridgeChartRenderer.jsx

import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import CustomYAxisTick from "./CustomYAxisTick";
import "./customTooltip/CustomTooltip.scss";
import { useTheme } from "../../context/ThemeContext";
import { compactNumber, preciseCurrency } from "../../functions/formatNumber";
import { GREEN_COLOR, GREY_COLOR, RED_COLOR } from "./chartColors";

/**
 * A horizontal BRIDGE (waterfall) chart (2026-10-23, DASHBOARD-CONVENTIONS §8
 * R7: a variance gets a bridge). Until now no renderer could float a bar, so
 * every "bridge" or "waterfall" in the app (Sales' budget gap, Finance's cash
 * flow) was a plain bar chart whose bars all started at zero -- the eye could
 * not walk from the start total to the end total.
 *
 * data: [{ name, value, kind }] in reading order, top to bottom:
 *   kind "start" | "end"   a total, drawn from zero. "start" is the plan
 *                          (grey, IBCS: plan is not actual), "end" the actual
 *                          (endColor, the measure's own colour)
 *   kind "delta"           a step from the running total: floats from where
 *                          the previous bar ended; green up, red down
 *
 * Built as two stacked bars -- an invisible offset, then the visible step --
 * so it needs nothing beyond Recharts. Horizontal because the categories are
 * names (IBCS: structure on the vertical axis, time on the horizontal).
 */
export default function BridgeChartRenderer({
  data = [],
  endColor = GREEN_COLOR,
  formatValue = preciseCurrency,
}) {
  const { darkMode } = useTheme();
  const axisColor = darkMode ? "#555" : "#ccc";
  const textColor = darkMode ? "#ececec" : "#666";

  let running = 0;
  const rows = data.map((d) => {
    const value = Number(d.value) || 0;
    if (d.kind === "delta") {
      const offset = value >= 0 ? running : running + value;
      running += value;
      return {
        ...d,
        offset,
        size: Math.abs(value),
        fill: value >= 0 ? GREEN_COLOR : RED_COLOR,
      };
    }
    running = value;
    return {
      ...d,
      offset: 0,
      size: value,
      fill: d.kind === "start" ? GREY_COLOR : endColor,
    };
  });

  const height = Math.max(160, 40 + rows.length * 34);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={rows}
        layout="vertical"
        margin={{ top: 5, right: 20, left: 40, bottom: 5 }}
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
          interval={0}
        />
        <ReferenceLine x={0} stroke={axisColor} />
        <Tooltip
          cursor={{ fill: "rgba(27, 27, 27, 0.15)" }}
          content={({ active, payload }) => {
            const row = active && payload?.[0]?.payload;
            if (!row) return null;
            const signed =
              row.kind === "delta" && row.value > 0
                ? `+${formatValue(row.value)}`
                : formatValue(row.value);
            return (
              <div
                className={`customTooltipContainer ${
                  darkMode ? "sectionDark" : "sectionLight"
                }`}
              >
                <div className="tooltipEntryContainer textXXXS">
                  <span
                    className="tooltipEntryCircle"
                    style={{ backgroundColor: row.fill }}
                  />
                  <span className="textBold">{row.name}:</span>
                  <span>{signed}</span>
                </div>
              </div>
            );
          }}
        />
        <Bar dataKey="offset" stackId="bridge" fill="transparent" isAnimationActive={false} />
        <Bar dataKey="size" stackId="bridge" barSize={20} radius={[0, 4, 4, 0]}>
          {rows.map((r) => (
            <Cell key={r.name} fill={r.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
