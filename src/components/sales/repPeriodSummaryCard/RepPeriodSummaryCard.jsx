import { CalendarCheckIcon } from "@phosphor-icons/react";
import StatusBox from "../../status/statusBox/StatusBox";
import IconCard from "../../iconCard/IconCard";
import ProgressBar from "../../progressBar/ProgressBar";
import "./RepPeriodSummaryCard.scss";

/**
 * One (rep, year) tile for the Sales Targets/Budgets master grouped-list
 * pages -- shared between both since it only ever receives plain
 * strings/numbers, never a rep-identity type (uuid vs. bigint stays the
 * caller's concern, see groupRowsByRepYear.js).
 */
export default function RepPeriodSummaryCard({
  repLabel,
  year,
  totalRevenue,
  filledMonths,
  revenueLabel,
  onClick,
}) {
  const filledPct = Math.round((filledMonths / 12) * 100);

  return (
    <div className="generalCard repPeriodSummaryCard" onClick={onClick}>
      <div className="repPeriodSummaryCardHeader">
        <p className="textBold textXS truncate" title={repLabel}>
          {repLabel}
        </p>
        <StatusBox status={String(year)} type="blue" />
      </div>

      <IconCard
        icon={CalendarCheckIcon}
        weight="fill"
        name={`${filledMonths}/12 months set`}
        style="green textXXXS textBold"
      />

      <div className="repPeriodSummaryCardRevenue">
        <p className="textLight textXXS">{revenueLabel}</p>
        <p className="textBold textM">
          {`RM ${Math.round(totalRevenue).toLocaleString()}`}
        </p>
      </div>

      <ProgressBar value={filledPct} label={`${repLabel} ${year} coverage`} />
    </div>
  );
}
