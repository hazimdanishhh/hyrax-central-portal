import { useState } from "react";
import {
  BLUE_COLOR,
  GREEN_COLOR,
  RED_COLOR,
} from "../../../chartCard/chartColors";
import EmployeeImage from "../../../employees/employeeImage/EmployeeImage";
import "./LeadsScoreCard.scss";
import CardLayout from "../../../cardLayout/CardLayout";

// actualLabel / targetLabel (2026-10-22): Leads Overview's CRM scorecard
// shows won revenue against a target (the defaults); Sales Reports' Team tab
// shows INVOICED revenue against a BUDGET and passes its own labels.
// row.flags (optional string[]) renders as check-in badges under the bar.
// row.details (optional [{label, value}], 2026-10-23) renders as plain lines
// beside the actual figure -- Leads Overview's Win Rate / Generated / Lost /
// Active Pipeline. Callers that pass neither are unchanged.
export default function ScorecardList({
  data = [],
  actualLabel = "Actual Won",
  targetLabel = "Target",
}) {
  const [hoveredUser, setHoveredUser] = useState(null);
  if (!data || data.length === 0) return null;

  // null = not applicable (e.g. no budget set) -> "—", never "RM 0".
  const formatRM = (val) =>
    val === null || val === undefined
      ? "—"
      : `RM ${Math.round(val).toLocaleString()}`;

  // Helper to get initials for the modern avatar
  const getInitials = (name) => {
    if (!name) return "U";
    const parts = name.split(" ");
    return parts.length > 1
      ? parts[0][0] + parts[1][0]
      : parts[0].substring(0, 2);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {data.map((row, idx) => {
        const {
          rep_name,
          actual_revenue,
          target_revenue,
          attainment_percentage,
          order_value_myr,
          po_vs_budget_variance_myr,
          po_vs_invoice_variance_myr,
          collected_myr,
          invoice_vs_collected_variance_myr,
          collection_rate_pct,
        } = row;

        // Sales Reports' PO-vs-Invoice-vs-Budget variance rows carry these
        // three fields; Leads Overview's CRM pipeline scorecard doesn't --
        // this segment only renders when they're present, so this shared
        // component still works for both callers.
        const hasOrderVariance = order_value_myr !== undefined;
        // Collected leg (added 2026-08, O2C funnel restructure) -- same
        // presence-gated pattern as hasOrderVariance above, so Leads
        // Overview's simpler CRM-only usage of this component is unaffected.
        const hasCollectedVariance = collected_myr !== undefined;

        // Progress bar logic
        const progressRaw =
          target_revenue > 0 ? (actual_revenue / target_revenue) * 100 : 0;
        const progressWidth = Math.min(progressRaw, 100); // Cap visual bar at 100%
        const isTargetMet = attainment_percentage >= 100;
        const barColor = isTargetMet ? GREEN_COLOR : BLUE_COLOR;

        return (
          <div key={idx} className="generalCard leadsScoreCard">
            <CardLayout style="cardLayout2">
              {/* 1. AVATAR & NAME */}
              <EmployeeImage
                // Pass the specific iteration's data, mapping the keys to match
                // what EmployeeImage likely expects based on your database schema.
                employee={{
                  id: row.lead_owner_id,
                  full_name: row.rep_name,
                  avatar_url: row.avatar_url,
                }}
                displayName={true}
                showName={false}
                setShowName={() => {}}
              />

              {/* 2. QUOTA PROGRESS BAR */}
              <div className="quotaSegment">
                <div className="quotaText textXXXS">
                  <span>
                    {attainment_percentage == null
                      ? `No ${targetLabel.toLowerCase()} set`
                      : `${attainment_percentage}% Attainment`}
                  </span>
                  <span>
                    {targetLabel}:{" "}
                    {target_revenue == null ? "—" : formatRM(target_revenue)}
                  </span>
                </div>

                {/* The Track */}
                <div className="quotaBarContainer">
                  {/* The Fill */}
                  <div
                    className="quotaBarFill"
                    style={{
                      width: `${progressWidth}%`,
                      backgroundColor: barColor,
                    }}
                  />
                </div>

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
            </CardLayout>

            <CardLayout style="cardLayout3">
              {/* 3. ACTUAL WON NUMBER */}
              <div className="actualWonSegment">
                <span className="textXS textLight">{actualLabel}</span>
                <span
                  className="textL textBold"
                  style={{ color: isTargetMet ? GREEN_COLOR : "inherit" }}
                >
                  {formatRM(actual_revenue)}
                </span>
              </div>

              {/* 4. PO (SALES ORDER) VS INVOICE VARIANCE -- Sales Reports only */}
              {hasOrderVariance && (
                <div className="varianceSegment">
                  <span className="textXXXS textLight">
                    Order Value (PO): {formatRM(order_value_myr)}
                  </span>
                  {po_vs_budget_variance_myr !== null && (
                    <span
                      className="textXXXS"
                      style={{
                        color:
                          po_vs_budget_variance_myr >= 0
                            ? GREEN_COLOR
                            : RED_COLOR,
                      }}
                    >
                      PO vs Budget: {po_vs_budget_variance_myr >= 0 ? "+" : ""}
                      {formatRM(po_vs_budget_variance_myr)}
                    </span>
                  )}
                  <span
                    className="textXXXS"
                    style={{
                      color:
                        po_vs_invoice_variance_myr >= 0
                          ? BLUE_COLOR
                          : RED_COLOR,
                    }}
                  >
                    PO vs Invoiced: {po_vs_invoice_variance_myr >= 0 ? "+" : ""}
                    {formatRM(po_vs_invoice_variance_myr)}
                  </span>
                </div>
              )}

              {/* 5. INVOICED VS COLLECTED -- Sales Reports only (O2C funnel's
                4th leg, added 2026-08) */}
              {hasCollectedVariance && (
                <div className="varianceSegment">
                  <span className="textXXXS textLight">
                    Collected: {formatRM(collected_myr)} (
                    {collection_rate_pct == null ? "—" : `${collection_rate_pct}%`})
                  </span>
                  <span
                    className="textXXXS"
                    style={{
                      color:
                        invoice_vs_collected_variance_myr >= 0
                          ? GREEN_COLOR
                          : RED_COLOR,
                    }}
                  >
                    Invoiced vs Collected:{" "}
                    {invoice_vs_collected_variance_myr >= 0 ? "+" : ""}
                    {formatRM(invoice_vs_collected_variance_myr)}
                  </span>
                </div>
              )}

              {row.details?.length > 0 && (
                <div className="varianceSegment">
                  {row.details.map((d) => (
                    <span key={d.label} className="textXXXS textLight">
                      {d.label}: <span className="textBold">{d.value}</span>
                    </span>
                  ))}
                </div>
              )}
            </CardLayout>
          </div>
        );
      })}
    </div>
  );
}
