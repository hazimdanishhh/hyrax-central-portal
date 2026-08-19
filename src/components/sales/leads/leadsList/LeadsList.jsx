import {
  BriefcaseIcon,
  CaretCircleRightIcon,
  CircleIcon,
  ClockClockwiseIcon,
  ClockIcon,
  DropIcon,
  FilePdfIcon,
  NotePencilIcon,
  UserCircleIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import { motion } from "framer-motion";
import AttendanceType from "../../../attendance/attendanceType/AttendanceType";
import Button from "../../../buttons/button/Button";
import CardLayout from "../../../cardLayout/CardLayout";
import "./LeadsList.scss";
import StatusBox from "../../../status/statusBox/StatusBox";
import EmployeeImage from "../../../employees/employeeImage/EmployeeImage";
import { useState } from "react";
import LeadStage, { PIPELINE_STAGES } from "../leadStage/LeadStage";
import IconCard from "../../../iconCard/IconCard";
import StatusIcon from "../../../status/statusIcon/StatusIcon";
import { formatDate } from "../../../../functions/formatDate";

export default function LeadsList({
  lead,
  onClick,
  saving,
  deleting,
  setIsEditing,
  selected,
  onSelect,
}) {
  const [showName, setShowName] = useState(false);
  //   BOOLEANS
  const isWon = lead.stage === "WON";
  const isLost = lead.stage === "LOST";
  const isCancelled = lead.is_cancelled;
  const isClosedLead = isWon || isLost || isCancelled;

  return (
    <motion.div
      className="generalCard cardPaddingMedium"
      onClick={saving ? null : deleting ? null : onClick}
      initial={{ y: 0 }}
      whileHover={{ y: -3 }}
    >
      <div className="leadsListContainer">
        <div className="leadsListHeaderWrapper">
          <div className="leadsListHeaderContainer">
            <div className="leadsListDateTimeContainer">
              <IconCard
                name={formatDate(lead.created_at)}
                icon={ClockIcon}
                style="textLight textXXXS cardStyle"
                size={14}
              />
              <IconCard
                name={formatDate(lead.updated_at)}
                icon={ClockClockwiseIcon}
                style="textLight textXXXS cardStyle"
                size={14}
              />
            </div>

            <LeadStage selectedRow={lead} list={true} />

            <div className="leadsListStatusContainer">
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

              <StatusIcon
                status={lead.product_type}
                icon={DropIcon}
                type="dark"
              />
            </div>

            <p className="textBold textXS">{lead.title}</p>
            {lead.description && (
              <p className="textLight textXXS employeeListMobile">
                {lead.description}
              </p>
            )}

            <IconCard
              name={lead.client?.name || lead.sap_customer?.customer_name}
              icon={BriefcaseIcon}
              style="textLight textXXS"
            />

            <IconCard
              name={lead.lead_owner?.preferred_name}
              icon={UserCircleIcon}
              style="textLight textXS"
            />

            <div className="leadsListDetails">
              <StatusBox
                status={`${lead.close_probability}% Probability`}
                type={
                  lead.close_probability > 75
                    ? "green"
                    : lead.close_probability < 40
                      ? "red"
                      : "yellow"
                }
              />
              <StatusBox
                status={`Expected: RM${lead.expected_revenue}`}
                type="blue"
              />
              {lead.actual_revenue && (
                <StatusBox
                  status={`Actual: RM${lead.actual_revenue}`}
                  type="green"
                />
              )}
              {lead.po_number && (
                <StatusBox
                  status={`PO Number: ${lead.po_number}`}
                  type="yellow"
                />
              )}
              {lead.pending_sap_order && (
                <IconCard
                  name="Pending SAP Order"
                  icon={WarningIcon}
                  style="textXXS red"
                  weight="fill"
                />
              )}
            </div>
          </div>
        </div>

        <div className="leadsListImageContainer">
          <EmployeeImage
            employee={lead.lead_owner}
            showName={showName}
            setShowName={setShowName}
            position="left"
            employeeId={lead.lead_owner?.id}
          />

          <CardLayout style="cardLayout1 cardGapSmall">
            {lead.quotation_url && (
              <a
                href={lead.quotation_url}
                className="textLight textXXS button buttonType4"
                target="_blank"
                rel="noopener noreferrer"
                title="View Quotation"
              >
                <FilePdfIcon size={16} />
              </a>
            )}
            {lead.po_document_url && (
              <a
                href={lead.po_document_url}
                className="textLight textXXS button buttonType4 approval"
                target="_blank"
                rel="noopener noreferrer"
                title="View PO"
              >
                <FilePdfIcon size={16} />
              </a>
            )}

            {!isClosedLead && (
              <Button
                style="iconButton2"
                onClick={setIsEditing}
                icon={NotePencilIcon}
                size={16}
                weight="light"
              />
            )}
          </CardLayout>
        </div>
      </div>
    </motion.div>
  );
}
