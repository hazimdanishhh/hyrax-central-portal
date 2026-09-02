import { ClockIcon } from "@phosphor-icons/react";
import { formatDate, formatDateTime } from "../../../functions/formatDate";
import EmployeeImage from "../../employees/employeeImage/EmployeeImage";
import IconCard from "../../iconCard/IconCard";
import "./LeaveCard.scss";

function LeaveCard({ leave, onClick }) {
  return (
    <div className="generalCard cardPaddingSmall">
      <div className="leaveCardHeader">
        <EmployeeImage
          employee={leave.employee}
          displayName
          showName={false}
          setShowName={() => {}}
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
    </div>
  );
}

export default LeaveCard;
