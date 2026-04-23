import CardLayout from "../../cardLayout/CardLayout";

export default function OverviewCards({ items = [] }) {
  return (
    <CardLayout style="cardLayout4">
      {items.map((item, index) => {
        const Icon = item.icon;

        return (
          <CardLayout key={index} style={`generalCard ${item.variant || ""}`}>
            <CardLayout style="cardLayoutFlex cardGapMedium cardLayoutNoPadding">
              {Icon && <Icon />}
              <h3 className="textRegular textS">{item.label}</h3>
            </CardLayout>

            <h2 className="textXL">{item.value}</h2>
          </CardLayout>
        );
      })}
    </CardLayout>
  );
}
