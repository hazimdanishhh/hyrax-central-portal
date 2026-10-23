import "./CustomLegend.scss";
import { preciseNumber } from "../../../functions/formatNumber";

// valueFormatter (optional, 2026-10-23): how each value is written, e.g.
// preciseCurrency for a ringgit chart. Defaults to the plain number.
export default function CustomLegend({ data, colorMap, valueFormatter = preciseNumber }) {
  // Number(d.value) -- a caller passing a pre-formatted string (e.g. from
  // .toFixed(2)) would otherwise turn this into string concatenation
  // instead of addition, producing an unparseable "total" and NaN% for
  // every entry.
  const total = data.reduce((sum, d) => sum + Number(d.value), 0);

  return (
    <div className="stackedLegend">
      {data.map((item) => {
        const percent = total ? ((item.value / total) * 100).toFixed(0) : 0;

        return (
          <div key={item.name} className="legendItem">
            <div className="legendHeaderContainer">
              <span
                className="legendColor"
                style={{ background: colorMap[item.name] }}
              />
              <span
                className="legendLabel"
                style={{ color: colorMap[item.name] }}
              >
                {item.name}
              </span>
            </div>
            <span className="textBold">
              {valueFormatter(item.value)}{" "}
              <span className="textLight">({percent}%)</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
