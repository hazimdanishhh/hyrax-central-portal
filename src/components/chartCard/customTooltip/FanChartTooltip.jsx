import "./CustomTooltip.scss";
import { preciseCurrency } from "../../../functions/formatNumber";

/**
 * Tooltip for FanChartRenderer.
 *
 * WHY THIS EXISTS RATHER THAN A PROP ON CustomTooltip
 *
 * A fan chart's band series carry a TWO-ELEMENT ARRAY as their value --
 * [lo, hi] -- which is how Recharts renders a ranged Area. CustomTooltip
 * cannot format that, and fails silently rather than loudly:
 *
 *   - it passes every value through preciseNumber(), which returns anything
 *     non-numeric unchanged, so the array is handed straight to React. React
 *     renders arrays by rendering each element, so "RM 2,146,830 - RM 6,593,225"
 *     comes out as two concatenated digit strings with no separator, no
 *     thousands marks and no RM;
 *   - its React key is entry.name, which collides when an Area and a Line
 *     share a series name;
 *   - its colour fallback reads entry.fill, which for an Area is the
 *     translucent band fill rather than a legible swatch.
 *
 * CustomTooltip is shared by eight existing charts. Adding an array branch to
 * it would put all eight at risk to serve one new caller, so the fan gets its
 * own and the shared component is left alone.
 *
 * Currency is spelled out here. Every other chart tooltip in the estate is
 * currency-unlabelled, which is tolerable on a bar chart with a titled axis
 * and not on a forecast where the band and the point estimate sit together.
 */
export default function FanChartTooltip({ active, payload, label, darkMode }) {
  if (!active || !payload || !payload.length) return null;

  // Recharts emits one entry per series. Pick them out by dataKey rather than
  // by position -- the render order of Areas and Lines is a layering decision
  // and must not be load-bearing here.
  const byKey = {};
  payload.forEach((entry) => {
    if (entry && entry.dataKey) byKey[entry.dataKey] = entry;
  });

  const actual = byKey.actual?.value;
  const projected = byKey.projected?.value;
  const band80 = byKey.band80?.value;
  const band95 = byKey.band95?.value;

  const isRange = (v) =>
    Array.isArray(v) && v.length === 2 && v[0] != null && v[1] != null;

  // The anchor month carries a degenerate band (lo === hi) purely so the shape
  // starts flush against the last actual. Showing "RM 2.4M - RM 2.4M" there
  // would be noise.
  const showBand = (v) => isRange(v) && v[0] !== v[1];

  const row = (key, name, color, text) => (
    <div key={key} className="tooltipEntryContainer textXXXS">
      <span style={{ backgroundColor: color }} className="tooltipEntryCircle" />
      <span className="textBold">{name}:</span>
      <span>{text}</span>
    </div>
  );

  const rows = [];

  if (typeof actual === "number") {
    rows.push(
      row("actual", "Invoiced (actual)", byKey.actual.stroke, preciseCurrency(actual)),
    );
  }

  // Shown on BOTH sides of the seam. On a past month this is what the model
  // would have said a month ahead, reconstructed point-in-time; forward it is
  // the live projection.
  if (typeof projected === "number") {
    rows.push(
      row(
        "projected",
        actual == null ? "Projected" : "Projected (1 month ahead)",
        byKey.projected.stroke,
        preciseCurrency(projected),
      ),
    );
  }

  // The whole point of carrying history on this chart: how far off was it.
  // Only meaningful where both exist, so it appears on past months only.
  if (typeof actual === "number" && typeof projected === "number" && actual !== 0) {
    const errPct = Math.round((projected / actual - 1) * 100);
    rows.push(
      row(
        "miss",
        "Forecast error",
        "transparent",
        `${errPct > 0 ? "+" : ""}${errPct}% ${errPct > 0 ? "over" : errPct < 0 ? "under" : ""}`.trim(),
      ),
    );
  }

  if (showBand(band80)) {
    rows.push(
      row(
        "band80",
        "80% range",
        byKey.band80.fill,
        `${preciseCurrency(band80[0])} – ${preciseCurrency(band80[1])}`,
      ),
    );
  }

  if (showBand(band95)) {
    rows.push(
      row(
        "band95",
        "95% range",
        byKey.band95.fill,
        `${preciseCurrency(band95[0])} – ${preciseCurrency(band95[1])}`,
      ),
    );
  }

  if (!rows.length) return null;

  return (
    <div
      className={
        darkMode
          ? "customTooltipContainer sectionDark"
          : "customTooltipContainer sectionLight"
      }
    >
      {label && (
        <div className="textBold" style={{ marginBottom: "4px" }}>
          {label}
        </div>
      )}
      {rows}
    </div>
  );
}
