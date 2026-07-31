import { Link } from "react-router";
import CardLayout from "../cardLayout/CardLayout";
import SectionHeader from "../sectionHeader/SectionHeader";
import buildFilterUrl from "../../functions/convertFilter";
import RouterButton from "../buttons/routerButton/RouterButton";
import { CaretRightIcon } from "@phosphor-icons/react";

export default function ChartCard({
  icon,
  title,
  subtitle,
  children,
  style,
  viewAllTo,
  viewAllFilter,
}) {
  const linkTo = viewAllTo
    ? `${viewAllTo}${viewAllFilter ? buildFilterUrl(viewAllFilter) : ""}`
    : null;

  return (
    <CardLayout style={`cardLayout1 generalCard ${style}`}>
      {linkTo ? (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            width: "100%",
          }}
        >
          {title && <SectionHeader icon={icon} title={title} />}
          <RouterButton
            to={linkTo}
            name="View All"
            style="button buttonType5"
            icon={CaretRightIcon}
          />
        </div>
      ) : (
        title && <SectionHeader icon={icon} title={title} />
      )}
      {subtitle && <p className="textLight textXXXS textCenter">{subtitle}</p>}

      {children}
    </CardLayout>
  );
}
