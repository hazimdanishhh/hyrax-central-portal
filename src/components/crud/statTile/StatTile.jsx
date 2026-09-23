import "./StatTile.scss";

/**
 * A single big-number + caption tile, used in the summary strip above a bulk
 * operation's preview/result table (e.g. "12 Would Add", "3 Would Skip").
 *
 * Extracted from CsvImportModal.jsx, which declared it privately -- the
 * attendance backfill wizard needs exactly the same tile, and a second copy
 * would be one more thing to keep visually in sync by hand.
 *
 * Styling still lives in CsvImportModal.scss (`csvImportStatTile`), which is
 * plain global CSS rather than a CSS module, so both consumers pick it up as
 * long as one of them has imported that stylesheet.
 */
export default function StatTile({ label, value, emphasize }) {
  return (
    <div className={`generalCard ${emphasize ? "greenCard" : "yellowCard"}`}>
      <p className="textBold textL">{value ?? 0}</p>
      <p className="textLight textXXS">{label}</p>
    </div>
  );
}
