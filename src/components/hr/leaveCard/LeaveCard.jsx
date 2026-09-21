import { ClockIcon } from "@phosphor-icons/react";
import { Link } from "react-router";
import { formatDate, formatDateTime } from "../../../functions/formatDate";
import EmployeeImage from "../../employees/employeeImage/EmployeeImage";
import IconCard from "../../iconCard/IconCard";
import "./LeaveCard.scss";

function LeaveCard({ leave, to }) {
  const Wrapper = to ? Link : "div";
  const wrapperProps = to
    ? { to, className: "generalCard cardPaddingSmall leaveCard" }
    : { className: "generalCard cardPaddingSmall leaveCard" };

  return (
    <Wrapper {...wrapperProps}>
      <div className="leaveCardHeader">
        <EmployeeImage
          employee={leave.employee}
          displayName
          showName={false}
          setShowName={() => {}}
          nestedLink={!to}
        />
        <div className="leaveCardDetails">
          <IconCard name={formatDate(leave.leave_date)} style="blue textXXS" />
          <IconCard
            name={`${leave.day_fraction} Day ${leave.leave_type?.label}`}
            style="yellow textXXS"
          />
        </div>
      </div>
      <div className="leaveCardFooter">
        <p className="textXXS leaveCardRemarks">
          Remarks: {leave.remarks || "--"}
        </p>
        <IconCard
          icon={ClockIcon}
          name={`Last Sync: ${formatDateTime(leave.last_seen_at)}`}
          style="grey textXXXS"
        />
      </div>
    </Wrapper>
  );
}

export default LeaveCard;
