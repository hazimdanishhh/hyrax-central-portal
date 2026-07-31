import "./CardLayout.scss";

function CardLayout({ children, style, title }) {
  return (
    <div className={style ? style : "cardLayout1"} title={title}>
      {children}
    </div>
  );
}

export default CardLayout;
