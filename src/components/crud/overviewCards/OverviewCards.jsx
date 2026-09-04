import { Link } from "react-router-dom"; // Ensure it's react-router-dom if you are using v6
import CardLayout from "../../cardLayout/CardLayout";
import buildFilterUrl from "../../../functions/convertFilter";
import "./OverviewCards.scss";

// `to`/`filter` -> a clickable href, or null if not clickable.
// `defaultTo` is what's used when `to` is omitted entirely (undefined):
// "../list" for a tile's own head region (the existing, unchanged default
// every current tile config across the app already relies on), but null for
// sub-metric rows -- a bare sub-metric with no `to` renders as a plain row,
// not a guess at "../list", since defaulting a sub-metric to the generic
// list would misrepresent it more often than it would help.
function resolveLinkTo(to, filter, defaultTo) {
  const base = to !== undefined ? to : defaultTo;
  if (!base) return null;
  const query = filter ? buildFilterUrl(filter) : "";
  return `${base}${query}`;
}

export default function OverviewCards({ items = [], style }) {
  return (
    <CardLayout style={`overviewCard4 ${style || ""}`}>
      {items.map((item) => {
        const Icon = item.icon;
        const linkTo = resolveLinkTo(item.to, item.filter, "../list");
        const HeadWrapper = linkTo ? Link : "div";
        const headWrapperProps = linkTo ? { to: linkTo } : {};

        return (
          <CardLayout
            key={item.label}
            style={`generalCard ${item.variant || ""}`}
            title={item.title}
          >
            {/* CLICKABLE HEAD REGION -- header + main metric only. Each
                sub-metric below is its own independent link (or plain row),
                a sibling of this one, not nested inside it -- nesting a
                second <Link> inside this one would be invalid HTML (nested
                anchors) and make click targeting ambiguous. */}
            <HeadWrapper {...headWrapperProps} className="overviewCardLink">
              <CardLayout style="cardLayoutFlex cardGapMedium cardLayoutNoPadding overviewCardHead">
                {Icon && <Icon size={24} weight="fill" />}
                <h3 className="textRegular textS">{item.label}</h3>
              </CardLayout>

              <div style={{ width: "100%" }}>
                {item.sublabel && (
                  <p className="textXXS textLight overviewCardLayout">
                    {item.sublabel}
                  </p>
                )}
                <div className="overviewCardValue">
                  <p className="textXS">{item.subvalue}</p>
                  <h2 className="textXL">{item.value}</h2>
                </div>
                {/* Severity badge for dynamic tiles (see getStatusVariant) --
                    icon + word, never color alone, so a colorblind or
                    screen-reader user still gets the reading. */}
                {item.status && (
                  <div className="overviewCardStatus">
                    {item.status.icon && (
                      <item.status.icon size={14} weight="bold" />
                    )}
                    <span className="textXXS textBold">
                      {item.status.label}
                    </span>
                  </div>
                )}
              </div>
            </HeadWrapper>

            {/* SUB METRICS (FOOTER) -- each row independently clickable via
                its own sub.to/sub.filter; no default fallback (see
                resolveLinkTo). */}
            {item.metrics && item.metrics.length > 0 && (
              <div className="metricsCardLayout">
                {item.metrics.map((sub, idx) => {
                  const subLinkTo = resolveLinkTo(sub.to, sub.filter, null);
                  const SubWrapper = subLinkTo ? Link : "div";
                  const subWrapperProps = subLinkTo ? { to: subLinkTo } : {};

                  return (
                    <SubWrapper
                      {...subWrapperProps}
                      key={sub.label ?? idx}
                      className={
                        subLinkTo
                          ? "metricsCard metricsCardLink"
                          : "metricsCard"
                      }
                    >
                      <span className="textXXS textLight metricsContent">
                        {sub.label}
                        {sub.icon && <sub.icon size={14} weight="bold" />}
                      </span>
                      <span className="textXS textBold">{sub.value}</span>
                    </SubWrapper>
                  );
                })}
              </div>
            )}
          </CardLayout>
        );
      })}
    </CardLayout>
  );
}
