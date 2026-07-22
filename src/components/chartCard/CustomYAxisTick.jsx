// components/chartCard/CustomYAxisTick.jsx

/**
 * Recharts' default YAxis tick doesn't truncate long category labels -- they
 * either overflow past the axis or run into the plot area. This renders a
 * fixed-length label with an ellipsis, and puts the full text in a native
 * SVG <title> so hovering still shows it.
 */
export default function CustomYAxisTick({
  x,
  y,
  payload,
  fill,
  fontSize = 12,
  maxLength = 14,
}) {
  const full = String(payload?.value ?? "");
  const truncated =
    full.length > maxLength ? `${full.slice(0, maxLength - 1)}…` : full;

  return (
    <text x={x} y={y} dy={4} textAnchor="end" fill={fill} fontSize={fontSize}>
      <title>{full}</title>
      {truncated}
    </text>
  );
}
