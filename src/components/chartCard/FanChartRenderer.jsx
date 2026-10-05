// components/chartCard/FanChartRenderer.jsx

import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";

import { useTheme } from "../../context/ThemeContext";
import FanChartTooltip from "./customTooltip/FanChartTooltip";
import { compactNumber } from "../../functions/formatNumber";
import { BLUE_COLOR, PURPLE_COLOR } from "./chartColors";

/**
 * Projection fan -- history as a solid line, the forward projection as a dashed
 * line, with nested 80% and 95% confidence bands.
 *
 * THE FIRST ComposedChart AND THE FIRST Area IN THIS CODEBASE. Every other
 * renderer in this folder is a BarChart, LineChart or PieChart, so there is no
 * local precedent for the two things that make this work:
 *
 *   1. A RANGED AREA. `band80` and `band95` are two-element arrays [lo, hi],
 *      not scalars. Recharts renders a tuple dataKey as a band between the two
 *      values. This is why the data cannot be reshaped into the flat
 *      {name, value} that the bar renderers take.
 *
 *   2. TWO LINES OVER ONE X AXIS, meeting exactly once. The RPC duplicates the
 *      last actual into `projected` on the final historical row, and gives that
 *      row a degenerate band (lo === hi). Without it the dashed line would
 *      start a month to the right of the solid one and visibly float, and the
 *      shaded band would begin detached from the history it continues.
 *      `connectNulls` stays FALSE so the two series genuinely stop where their
 *      data stops.
 *
 * Bands are drawn before lines so they layer behind. Recharts paints in
 * child order, so moving these is a visual change, not a cosmetic one.
 *
 * The tooltip is FanChartTooltip, NOT the shared CustomTooltip -- see that
 * file for why the shared one renders array values as garbage.
 */
export default function FanChartRenderer({
  data = [],
  height = 340,
  showGrid = true,
  showLegend = true,
  // Month label of the last actual. Drawn as a vertical rule so the eye can
  // tell fact from forecast without reading the legend.
  forecastStartLabel,
}) {
  const { darkMode } = useTheme();

  const axisColor = darkMode ? "#555" : "#ccc";
  const textColor = darkMode ? "#ececec" : "#666";

  // The 95% band sits behind the 80% and must read as the fainter of the two,
  // or the nesting inverts and the wider band looks like the more confident one.
  const band95Fill = darkMode ? "rgba(103,99,215,0.14)" : "rgba(103,99,215,0.10)";
  const band80Fill = darkMode ? "rgba(103,99,215,0.30)" : "rgba(103,99,215,0.22)";

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data}>
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
          minTickGap={24}
        />

        <YAxis
          stroke={axisColor}
          tick={{ fill: textColor, fontSize: 12 }}
          tickLine={false}
          tickFormatter={compactNumber}
        />

        <Tooltip
          cursor={{ stroke: "rgba(120,120,120,0.35)", strokeWidth: 1 }}
          content={<FanChartTooltip darkMode={darkMode} />}
        />

        {showLegend && (
          <Legend wrapperStyle={{ fontSize: 12, color: textColor }} />
        )}

        {/* Bands first -- they must layer behind both lines. */}
        <Area
          dataKey="band95"
          name="95% range"
          stroke="none"
          fill={band95Fill}
          connectNulls={false}
          isAnimationActive={false}
          activeDot={false}
        />
        <Area
          dataKey="band80"
          name="80% range"
          stroke="none"
          fill={band80Fill}
          connectNulls={false}
          isAnimationActive={false}
          activeDot={false}
        />

        {forecastStartLabel && (
          <ReferenceLine
            x={forecastStartLabel}
            stroke={axisColor}
            strokeDasharray="4 4"
          />
        )}

        <Line
          type="monotone"
          dataKey="actual"
          name="Invoiced (actual)"
          stroke={BLUE_COLOR}
          strokeWidth={3}
          dot={false}
          activeDot={{ r: 5, fill: BLUE_COLOR, strokeWidth: 0 }}
          connectNulls={false}
          isAnimationActive={false}
        />

        <Line
          type="monotone"
          dataKey="projected"
          name="Projected"
          stroke={PURPLE_COLOR}
          strokeWidth={3}
          strokeDasharray="6 4"
          dot={false}
          activeDot={{ r: 5, fill: PURPLE_COLOR, strokeWidth: 0 }}
          connectNulls={false}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
