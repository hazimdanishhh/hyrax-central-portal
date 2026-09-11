import "./DetailRow.scss";

export default function DetailRow({ label, value }) {
  return (
    <div className="detailRow">
      <p className="textBold textXXS">{label}</p>
      <p className="textRegular textXS">{value}</p>
    </div>
  );
}
