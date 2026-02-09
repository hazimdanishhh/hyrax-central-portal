import "./CardWrapper.scss";

export default function CardWrapper({ children, noPadding }) {
  return (
    <div className="cardWrapper">
      <div className={noPadding ? "" : "cardPadding"}>{children}</div>
    </div>
  );
}
