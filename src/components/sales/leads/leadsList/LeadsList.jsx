import {
  BriefcaseIcon,
  CaretCircleRightIcon,
  CircleIcon,
  NotePencilIcon,
} from "@phosphor-icons/react";
import { motion } from "framer-motion";
import AttendanceType from "../../../attendance/attendanceType/AttendanceType";
import Button from "../../../buttons/button/Button";
import CardLayout from "../../../cardLayout/CardLayout";
import "./LeadsList.scss";
import StatusBox from "../../../status/statusBox/StatusBox";
import EmployeeImage from "../../../employees/employeeImage/EmployeeImage";
import { useState } from "react";
import LeadStage from "../leadStage/LeadStage";
import IconCard from "../../../iconCard/IconCard";

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

  console.log(lead);
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
              <p className="textRegular textXXS employeeListMobile">
                {lead.created_date}
              </p>
              <p className="textLight textXXXS employeeListMobile">
                {lead.created_time}
              </p>
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
                      : "green"
                }
              />

              {lead.is_on_hold && <StatusBox status="ON HOLD" type="yellow" />}
              {lead.is_cancelled && <StatusBox status="CANCELLED" type="red" />}
            </div>

            <p className="textBold textXS">{lead.title}</p>
            <p className="textLight textXXS employeeListMobile">
              {lead.description}
            </p>

            <IconCard
              name={lead.client?.name}
              icon={BriefcaseIcon}
              style="textLight textXXS"
            />

            <p className="textLight textXXXS employeeListMobile cardStyle">
              <span className="textRegular">Success Probability: </span>
              {lead.close_probability}%
            </p>
            <p className="textLight textXXXS employeeListMobile cardStyle">
              <span className="textRegular">Expected Revenue: </span>
              RM{lead.expected_revenue}
            </p>
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
          <Button
            style="iconButton2"
            onClick={setIsEditing}
            icon={NotePencilIcon}
            size={16}
            weight="light"
          />
        </div>
      </div>
    </motion.div>
  );
}
