// src/components/sales/leads/leadRow/LeadRow.jsx
//
// A lead as a two-line ListRow (2026-10-27) -- the Leads list's replacement
// for the LeadsList card. The full card still shows in the sidebar.
//
//   (owner)  line 1   title                                   value (RM)
//            line 2   [Stage ▮▮▮▯▯] · 60% · account · owner · Updated 25 Oct   [On Hold] [Pending SAP]
//
// Value: a won lead shows its won (actual) revenue, every other lead its
// expected revenue -- the same split as sales_lead_facts' won_myr /
// expected_myr. The tooltip says which.
import ListRow from "../../../crud/listRow/ListRow";
import { PIPELINE_STAGES } from "../leadStage/LeadStage";
import { preciseCurrencyWithCents } from "../../../../functions/formatNumber";

function stageLabel(stage) {
  if (!stage) return "No stage";
  return stage
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// The card's own stage colours (LeadsList.jsx).
function stageTone(lead) {
  if (lead.is_cancelled || lead.stage === "LOST") return "red";
  if (lead.is_on_hold) return "yellow";
  if (PIPELINE_STAGES.includes(lead.stage)) return "blue";
  return "green";
}

// The card's close-probability bands.
function probabilityTone(probability) {
  const value = probability ?? 0;
  if (value >= 70) return "green";
  if (value >= 40) return "yellow";
  return "red";
}

// The sidebar tracker in miniature: 4 pipeline stages + the outcome.
// Won fills all 5; lost (its stage is LOST, so where it stopped is unknown)
// fills all 5 in red; an open, on-hold or cancelled lead fills up to its stage.
const STEPS = PIPELINE_STAGES.length + 1;

function stageProgress(lead) {
  if (lead.stage === "WON" || lead.stage === "LOST") {
    return { steps: STEPS, done: STEPS };
  }
  return { steps: STEPS, done: PIPELINE_STAGES.indexOf(lead.stage) + 1 };
}

export default function LeadRow({ lead, to, active, disabled }) {
  const isWon = lead.stage === "WON" && !lead.is_cancelled;
  const showWon = isWon && lead.actual_revenue != null;
  const isOpen = PIPELINE_STAGES.includes(lead.stage) && !lead.is_cancelled;
  const account =
    lead.client?.name || lead.sap_customer?.customer_name || "No account";

  return (
    <ListRow
      to={to}
      active={active}
      disabled={disabled}
      title={lead.title || "Untitled lead"}
      figure={preciseCurrencyWithCents(
        showWon ? lead.actual_revenue : lead.expected_revenue,
      )}
      figureTitle={showWon ? "Won revenue" : "Expected revenue"}
      people={[lead.lead_owner]}
      status={{
        label: stageLabel(lead.stage),
        tone: stageTone(lead),
        progress: stageProgress(lead),
      }}
      meta={[
        // Probability only means something while the lead is open.
        isOpen && lead.close_probability != null && (
          <span
            className={probabilityTone(lead.close_probability)}
            title="Close probability"
          >
            {lead.close_probability}%
          </span>
        ),
        account,
        lead.lead_owner?.employee_name || lead.lead_owner?.full_name,
        lead.updated_date && `Updated ${lead.updated_date}`,
      ]}
      flags={[
        lead.is_on_hold && { label: "On Hold", tone: "yellow" },
        lead.is_cancelled && { label: "Cancelled", tone: "red" },
        // sales_lead_facts' rule: won, not cancelled, PO not in SAP yet.
        lead.pending_sap_order && {
            label: "Pending SAP",
            tone: "red",
            title:
              "SAP Sales Admin has not created the Sales Order for this lead / the PO number isn't matched",
          },
      ]}
    />
  );
}
