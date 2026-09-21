import {
  BriefcaseIcon,
  CaretCircleRightIcon,
  CircleIcon,
  ClockClockwiseIcon,
  ClockIcon,
  CopyIcon,
  DropIcon,
  FilePdfIcon,
  NotePencilIcon,
  UserCircleIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import Button from "../../../buttons/button/Button";
import CardLayout from "../../../cardLayout/CardLayout";
import "./LeadsList.scss";
import StatusBox from "../../../status/statusBox/StatusBox";
import EmployeeImage from "../../../employees/employeeImage/EmployeeImage";
import LeadStage, { PIPELINE_STAGES } from "../leadStage/LeadStage";
import IconCard from "../../../iconCard/IconCard";
import StatusIcon from "../../../status/statusIcon/StatusIcon";
import { formatDate } from "../../../../functions/formatDate";
import { useMessage } from "../../../../context/MessageContext";
import LinkButton from "../../../buttons/linkButton/LinkButton";
import SAPCustomerCard from "../../../client/sapCustomerCard/SAPCustomerCard";
import { compactCurrency } from "../../../../functions/formatNumber";
import { getAmountTone } from "../../../../functions/documentFigureTone";
import { Link } from "react-router";

// Close-probability bands for the figures row below -- not reused
// elsewhere (unlike getAmountTone/getBalanceTone/getMarginTone in
// documentFigureTone.js), since this is a lead-forecast-confidence
// concept, not a document-figure-vs-total one: >=70% is a likely close
// (green), 40-69% is a real but unsettled chance (yellow), below that is
// at-risk (red).
function getProbabilityTone(probability) {
  const value = probability ?? 0;
  if (value >= 70) return "green";
  if (value >= 40) return "yellow";
  return "red";
}

/**
 * Read-only-shell list card -- restructured (2026-09) to match
 * FulfillmentOrderCard.jsx's own top-to-bottom rhythm instead of the old
 * single flex-row split (main column + a side avatar/actions rail), so both
 * cards read the same way: a Header row (status flags left, dates right), a
 * bordered-off Stage row, an Identity block (who/what this record is and
 * connects to), a bordered-off Figures block (the numbers), then a Footer
 * row (avatar + actions) -- no functionality removed, every field below
 * still renders exactly what it did before, just grouped so a viewer scans
 * status -> progress -> identity -> numbers -> actions in one direction
 * instead of two columns competing for attention.
 */
export default function LeadsList({
  lead,
  to,
  saving,
  deleting,
  setIsEditing,
  selected,
  onSelect,
  nestedLink = !to,
  showStage = true,
}) {
  const { showMessage } = useMessage();

  async function handleCopyPoNumber(e) {
    e.stopPropagation();
    if (!lead.po_number) return;

    try {
      await navigator.clipboard.writeText(lead.po_number);
      showMessage("PO Number Copied to Clipboard", "success");
    } catch (err) {
      console.error("Failed to copy:", err);
      showMessage(`Failed to copy: ${err}`, "error");
    }
  }

  //   BOOLEANS
  const isWon = lead.stage === "WON";
  const isLost = lead.stage === "LOST";
  const isCancelled = lead.is_cancelled;
  const isClosedLead = isWon || isLost || isCancelled;
  const isSapLinked = Boolean(lead.sap_customer_code);
  const accountName = lead.client?.name || lead.sap_customer?.customer_name;
  const Wrapper = to ? Link : "div";
  const wrapperProps = to
    ? {
        to,
        className: "generalCard cardPaddingMedium leadsListCard",
        onClick: (e) => {
          if (saving || deleting) e.preventDefault();
        },
      }
    : { className: "generalCard cardPaddingMedium leadsListCard" };
  return (
    <Wrapper {...wrapperProps}>
      {/* HEADER -- status/flag cluster on the left, dates on the right,
          mirrors FulfillmentOrderCard's own header row. */}
      <div className="leadsListCardHeader">
        <div className="leadsListCardStatus">
          <StatusIcon status={lead.product_type} icon={DropIcon} type="dark" />
        </div>

        {showStage && (
          <div className="leadsListCardDates">
            <IconCard
              icon={ClockIcon}
              weight="fill"
              name={`Created: ${formatDate(lead.created_at)}`}
              style="blue textXXXS textBold"
              size={14}
            />
            <IconCard
              icon={ClockClockwiseIcon}
              weight="fill"
              name={`Updated: ${formatDate(lead.updated_at)}`}
              style="yellow textXXXS textBold"
              size={14}
            />
          </div>
        )}
      </div>

      {/* STAGE -- bordered-off full-width row, mirrors
          fulfillmentOrderCardStageRow. */}
      {showStage && (
        <div className="leadsListCardStageRow">
          <LeadStage selectedRow={lead} list={true} />

          <div className="leadsListCardStageContainer">
            <StatusBox
              status={lead.stage}
              type={
                lead.is_cancelled || lead.stage === "LOST"
                  ? "red"
                  : lead.is_on_hold
                    ? "yellow"
                    : PIPELINE_STAGES.includes(lead.stage)
                      ? "blue"
                      : "green"
              }
            />

            {lead.is_on_hold && <StatusBox status="ON HOLD" type="yellow" />}
            {lead.is_cancelled && <StatusBox status="CANCELLED" type="red" />}

            {lead.pending_sap_order && (
              <IconCard
                name="Pending SAP Order"
                icon={WarningIcon}
                style="textXXS textBold red"
                weight="fill"
                title="SAP Sales Admin has not created the Sales Order for this Lead / the PO number isn't matched"
              />
            )}
          </div>
        </div>
      )}

      {/* IDENTITY -- title/description, then who/what this lead connects to
          (client, owner, matched PO), mirrors FulfillmentOrderCard's own
          SO#/customer/PO/rep identity grid. */}
      <div className="leadsListCardIdentity">
        <p className="textBold textXS">{lead.title}</p>
        {lead.description && (
          <p className="textLight textXXS employeeListMobile">
            {lead.description}
          </p>
        )}

        <CardLayout style="cardLayout2 cardGapSmall">
          <SAPCustomerCard
            code={isSapLinked ? lead.sap_customer_code : lead.client_id}
            name={accountName}
            isSapLinked={isSapLinked}
            nestedLink={nestedLink}
          />

          <EmployeeImage
            employee={lead.lead_owner}
            showName={false}
            setShowName={() => {}}
            position="right"
            employeeId={lead.lead_owner?.id}
            displayName
            nestedLink={nestedLink}
          />

          {lead.po_number && (
            <div className="leadPoNumberGroup">
              <p className="textBold textXS">PO# {lead.po_number || "—"}</p>

              {nestedLink && (
                <Button
                  onClick={handleCopyPoNumber}
                  icon={CopyIcon}
                  style="iconButton2"
                  size={14}
                  title="Copy PO Number"
                />
              )}
            </div>
          )}
        </CardLayout>
      </div>

      {/* FIGURES -- bordered-off, mirrors fulfillmentOrderCardFigures. */}
      <div className="leadsListCardFigures cardLayout2 cardGapSmall cardLayoutMin2">
        <p
          className={`textLight textXXS ${getProbabilityTone(lead.close_probability)}`}
        >
          <strong className="textBold">Probability:</strong>{" "}
          {lead.close_probability}%
        </p>
        <p className="textLight textXXS">
          <strong className="textBold">Expected Revenue:</strong>{" "}
          {compactCurrency(lead.expected_revenue)}
        </p>
        {lead.actual_revenue && (
          <p
            className={`textLight textXXS ${getAmountTone(lead.actual_revenue, lead.expected_revenue)}`}
          >
            <strong className="textBold">Actual Revenue:</strong>{" "}
            {compactCurrency(lead.actual_revenue)}
          </p>
        )}
      </div>

      {/* FOOTER -- avatar + actions, its own row instead of a side rail, so
          the whole card reads top-to-bottom in one column. */}
      <div className="leadsListCardFooter">
        <CardLayout style="cardLayout2 cardGapSmall">
          {lead.quotation_url && (
            <LinkButton
              href={lead.quotation_url}
              style="textLight textXXS button buttonType4"
              name="View Quotation"
              icon={FilePdfIcon}
              nestedLink={nestedLink}
            />
          )}
          {lead.po_document_url && (
            <LinkButton
              href={lead.po_document_url}
              style="textLight textXXS button buttonType4 approval"
              name="View PO"
              icon={FilePdfIcon}
              nestedLink={nestedLink}
            />
          )}
        </CardLayout>

        {!isClosedLead && showStage && (
          <Button
            style="iconButton2"
            onClick={setIsEditing}
            icon={NotePencilIcon}
            size={16}
            weight="light"
          />
        )}
      </div>
    </Wrapper>
  );
}
