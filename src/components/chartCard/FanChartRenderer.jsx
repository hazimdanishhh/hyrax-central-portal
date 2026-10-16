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
 *
 * ── CLICK-TO-SELECT (added 2026-10-16) ────────────────────────────────────
 *
 * The FIRST chart in this codebase whose click sets IN-PAGE STATE rather than
 * navigating. Every other renderer here follows DASHBOARD-CONVENTIONS.md
 * §4d's drill-through contract: the handler returns a URL and the renderer
 * calls `openChartClickThrough` to open it in a new tab. This one does not --
 * `onMonthClick` returns nothing, and the page uses the clicked month to
 * re-point two sibling charts and a KPI tile. VerticalMultiBarRenderer is the
 * only existing precedent for a raw, non-navigating callback.
 *
 * CHART-LEVEL onClick, NOT activeDot. LineChartRenderer hangs its clicks off
 * `activeDot`, which does not work here: both lines are `dot={false}`, and
 * `actual` is null on every future month -- so dot-based clicks would leave
 * the whole forward half of the chart dead. ComposedChart's own onClick fires
 * for the entire month column, including blank months, which is what a
 * 12-month fiscal spine needs.
 *
 * It hands up `activeLabel` (the X category string). The PAGE maps that back
 * to a machine month key through its own data; §4d forbids re-deriving a
 * click target by parsing a display label, and `periodMonth` travels on every
 * row for exactly this.
 */
export default function FanChartRenderer({
  data = [],
  height = 340,
  showGrid = true,
  showLegend = true,
  // Month label of the last actual. Drawn as a vertical rule so the eye can
  // tell fact from forecast without reading the legend.
  forecastStartLabel,
  // (name) => void. Optional -- without it the chart is inert, as it was.
  onMonthClick,
  // The `name` of the currently selected month, highlighted as a column.
  selectedMonth,
}) {
  const { darkMode } = useTheme();

  const axisColor = darkMode ? "#555" : "#ccc";
  const textColor = darkMode ? "#ececec" : "#666";

  // The 95% band sits behind the 80% and must read as the fainter of the two,
  // or the nesting inverts and the wider band looks like the more confident one.
  //
  // Raised 2026-10-16 -- the original values were invisible against both a
  // white and a black card. The RATIO between them is what carries the nesting
  // (95% stays roughly half the 80%), so both moved together rather than just
  // lifting the floor.
  //
  // Dark mode needs MORE opacity than light, not less: a translucent fill
  // lightens a dark background but darkens a light one, and the eye reads the
  // lightening as weaker. The first version had this backwards at the 80%
  // level and inconsistent at the 95%.
  const band95Fill = darkMode ? "rgba(103,99,215,0.26)" : "rgba(103,99,215,0.20)";
  const band80Fill = darkMode ? "rgba(103,99,215,0.52)" : "rgba(103,99,215,0.40)";

  // Neutral grey, not the series purple: the selection marks WHICH column you
  // are reading, it does not add a third quantity to a chart that already has
  // two nested bands.
  const selectionFill = darkMode
    ? "rgba(255,255,255,0.10)"
    : "rgba(0,0,0,0.06)";

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart
        data={data}
        onClick={
          onMonthClick
            ? (state) => {
                // Recharts fires onClick with no activeLabel when the click
                // lands outside the plot area. Guard, or a stray click on the
                // legend clears the selection.
                if (state?.activeLabel) onMonthClick(state.activeLabel);
              }
            : undefined
        }
        style={onMonthClick ? { cursor: "pointer" } : undefined}
      >
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

        {/* The selected column, behind everything including the bands.
            A thick translucent ReferenceLine, not a ReferenceArea: this XAxis
            is point-scaled, so a ReferenceArea from a category to ITSELF has
            zero width, and spanning to a neighbour would highlight two months.
            The width is therefore fixed pixels rather than one axis band --
            roughly a month's slot on a phone, a little narrow on a wide
            screen. Recharts has no "highlight this category" primitive. */}
        {selectedMonth && (
          <ReferenceLine
            x={selectedMonth}
            stroke={selectionFill}
            strokeWidth={22}
            ifOverflow="hidden"
          />
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
