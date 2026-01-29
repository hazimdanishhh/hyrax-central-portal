import "./CardLayout.scss";

function CardLayout({ children, style }) {
  return <div className={style ? style : "cardLayout1"}>{children}</div>;
}

export default CardLayout;
