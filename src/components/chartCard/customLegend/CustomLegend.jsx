import "./CustomLegend.scss";

export default function CustomLegend({ data, colorMap }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

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
              {item.value} <span className="textLight">({percent}%)</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
