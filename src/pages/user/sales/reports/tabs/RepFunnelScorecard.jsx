// src/pages/user/sales/reports/tabs/RepFunnelScorecard.jsx

import EmployeeImage from "../../../../../components/employees/employeeImage/EmployeeImage";
import { MEASURE_COLORS } from "../../../../../components/chartCard/chartColors";
import { getStatusVariant } from "../../../../../functions/statusVariant";
import { preciseCurrency } from "../../../../../functions/formatNumber";
import {
  BUDGET_THRESHOLDS,
  TARGET_THRESHOLDS,
} from "../../../../../functions/reportFormat";
import "../../../../../components/sales/leads/leadsScoreCard/LeadsScoreCard.scss";
import "./RepFunnelScorecard.scss";

/**
 * The Team tab's Rep Funnel Scorecard (2026-10-23): one card per
 * salesperson, the funnel left to right -- Pipeline Won vs Pipeline Target
 * (with Win Rate), Sales Orders, Invoiced Revenue vs Revenue Budget,
 * Payments Collected -- then the rep's open balances TODAY, and check-in
 * flags.
 *
 * Team-only on purpose. Leads Overview's LeadsScoreCard (a CRM won-vs-target
 * list) is a different card for a different page; bending it into a
 * four-stage funnel would put Leads Overview at risk for no gain there. The
 * look is shared through LeadsScoreCard.scss.
 *
 * Rows come from get_sales_team's scorecard. Nulls render as "—": no target
 * or budget set, or no SAP / CRM side for this salesperson.
 */
export default function RepFunnelScorecard({ rows = [] }) {
  if (!rows.length) return null;

  return (
    <div className="repFunnelScorecard">
      {rows.map((row) => (
        <div
          key={`${row.salesRepCode ?? "x"}-${row.employeeId ?? "x"}-${row.name}`}
          className="generalCard leadsScoreCard repFunnelCard"
        >
          <div className="repFunnelHead">
            <EmployeeImage
              employee={{
                id: row.employeeId,
                full_name: row.name,
                avatar_url: row.avatarUrl,
              }}
              displayName={true}
              showName={false}
              setShowName={() => {}}
            />
            {row.flags?.length > 0 && (
              <div className="scorecardFlags">
                {row.flags.map((flag) => (
                  <span key={flag} className="scorecardFlag textXXXS">
                    {flag}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="repFunnelSteps">
            <FunnelStep
              label="Pipeline Won"
              value={row.won}
              color={MEASURE_COLORS.pipelineWon}
              plan={{
                label: "Pipeline Target",
                value: row.target,
                pct: row.targetAttainmentPct,
                thresholds: TARGET_THRESHOLDS,
              }}
              note={
                row.winRatePct == null ? null : `Win Rate ${row.winRatePct}%`
              }
            />
            <FunnelStep
              label="Sales Orders"
              value={row.booked}
              color={MEASURE_COLORS.salesOrders}
            />
            <FunnelStep
              label="Invoiced Revenue"
              value={row.invoiced}
              color={MEASURE_COLORS.invoicedRevenue}
              plan={{
                label: "Revenue Budget",
                value: row.budget,
                pct: row.attainmentPct,
                thresholds: BUDGET_THRESHOLDS,
              }}
            />
            <FunnelStep
              label="Payments Collected"
              value={row.collected}
              color={MEASURE_COLORS.paymentsCollected}
            />
          </div>

          {row.overdueValue != null && (
            <p className="repFunnelToday textXXXS textLight">
              <span className="textBold">Today:</span> Delivered, Not Invoiced{" "}
              {preciseCurrency(row.unbilledValue)} · Overdue Delivery{" "}
              {preciseCurrency(row.overdueDeliveryValue)} · Overdue{" "}
              {preciseCurrency(row.overdueValue)} · Critically Overdue{" "}
              {preciseCurrency(row.criticalValue)}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function FunnelStep({ label, value, color, plan, note }) {
  const status = plan
    ? getStatusVariant(plan.pct ?? null, {
        direction: "high-good",
        thresholds: plan.thresholds,
      })
    : null;
  const width = plan?.pct == null ? 0 : Math.min(Math.max(plan.pct, 0), 100);

  return (
    <div className="repFunnelStep">
      <span className="textXXS textLight">{label}</span>
      <span className="textM textBold">
        {value == null ? "—" : preciseCurrency(value)}
      </span>

      {plan && (
        <>
          <div className="quotaBarContainer">
            <div
              className="quotaBarFill"
              style={{ width: `${width}%`, backgroundColor: color }}
            />
          </div>
          <span className={`textXXXS repFunnelPlan ${status?.level ?? ""}`}>
            {plan.value == null
              ? `No ${plan.label} set`
              : `${plan.pct ?? "—"}% of ${plan.label} (${preciseCurrency(plan.value)})`}
          </span>
        </>
      )}

      {note && <span className="textXXXS textLight">{note}</span>}
    </div>
  );
}
