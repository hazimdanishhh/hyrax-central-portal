import { Link } from "react-router-dom"; // Ensure it's react-router-dom if you are using v6
import CardLayout from "../../cardLayout/CardLayout";
import buildFilterUrl from "../../../functions/convertFilter";
import "./OverviewCards.scss";

export default function OverviewCards({ items = [] }) {
  return (
    <CardLayout style="overviewCard4">
      {items.map((item) => {
        const Icon = item.icon;
        const to = item.filter ? buildFilterUrl(item.filter) : "";

        return (
          <Link
            to={`../list${to}`}
            key={item.label}
            className="overviewCardLink"
          >
            <CardLayout style={`generalCard ${item.variant || ""}`}>
              {/* CARD HEADER */}
              <CardLayout style="cardLayoutFlex cardGapMedium cardLayoutNoPadding">
                {Icon && <Icon size={24} weight="fill" />}
                <h3 className="textRegular textS">{item.label}</h3>
              </CardLayout>

              {/* MAIN METRIC */}
              <div
                style={{
                  width: "100%",
                }}
              >
                {item.sublabel && (
                  <p className="textXXS textLight overviewCardLayout">
                    {item.sublabel}
                  </p>
                )}
                <h2 className="textXL overviewCardValue">{item.value}</h2>
              </div>

              {/* SUB METRICS (FOOTER) */}
              {item.metrics && item.metrics.length > 0 && (
                <div className="metricsCardLayout">
                  {item.metrics.map((sub, idx) => (
                    <div key={idx} className="metricsCard">
                      <span className="textXXS textLight metricsContent">
                        {sub.label}
                        {sub.icon && <sub.icon size={14} weight="bold" />}
                      </span>
                      <span className="textXS textBold">{sub.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardLayout>
          </Link>
        );
      })}
    </CardLayout>
  );
}
