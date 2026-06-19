import { Link } from "react-router";
import CardLayout from "../../cardLayout/CardLayout";
import buildFilterUrl from "../../../functions/convertFilter";
import "./OverviewCards.scss";

export default function OverviewCards({ items = [] }) {
  return (
    <CardLayout style="cardLayout4">
      {items.map((item, index) => {
        const Icon = item.icon;
        const to = item.filter ? buildFilterUrl(item.filter) : "";

        return (
          <Link to={to} key={item.label}>
            <CardLayout style={`generalCard ${item.variant || ""}`}>
              <CardLayout style="cardLayoutFlex cardGapMedium cardLayoutNoPadding overviewCardLayout">
                {Icon && <Icon size={24} weight="fill" />}
                <h3 className="textRegular textS">{item.label}</h3>
              </CardLayout>

              {item.sublabel && (
                <p className="textXXS textLight" style={{ textAlign: "start" }}>
                  {item.sublabel}
                </p>
              )}

              <h2 className="textXL overviewCardValue">{item.value}</h2>
            </CardLayout>
          </Link>
        );
      })}
    </CardLayout>
  );
}
