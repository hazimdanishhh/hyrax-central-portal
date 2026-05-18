import "./StatusBox.scss";

// STATUS BOX
// RED, GREEN, YELLOW, GREY, BLUE
export default function StatusBox({ status, type }) {
  return (
    <div className={`textLight textXXXS statusBox ${type}`}>
      <p className="textLight textXXXS statusName">{status || "No Status"}</p>
    </div>
  );
}
