// components/sales/leads/leadStageTab/LeadStageTab.jsx
import { Link } from "react-router-dom";

export default function LeadStageTab({ to, label, isActive, themeType }) {
  return (
    <Link
      to={to}
      className={`button buttonType5 ${themeType} textRegular textXS ${isActive ? "active" : ""}`}
    >
      {label}
    </Link>
  );
}
