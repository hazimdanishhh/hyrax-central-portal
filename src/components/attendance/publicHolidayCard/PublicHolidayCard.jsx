import { MapPinIcon, TagIcon } from "@phosphor-icons/react";
import { formatDate } from "@/functions/formatDate";
import IconCard from "../../iconCard/IconCard";
import "./PublicHolidayCard.scss";

// category -> IconCard color, same badge language as LeaveCard's own
// date/type pills.
const CATEGORY_STYLE = {
  national: "green",
  state: "yellow",
  company: "red",
};

/**
 * Card view for a single public_holidays row -- HR's Attendance > Settings
 * page (AttendanceSettings.jsx). Modeled directly on LeaveCard.jsx (the
 * closest existing shape: a date badge + a categorical label pill, no
 * per-activity edit/approve actions) rather than ITAssetList.jsx, since a
 * holiday isn't assigned to one employee -- no EmployeeImage/assignee
 * concept applies here.
 */
function PublicHolidayCard({ holiday, onClick }) {
  const categoryLabel =
    holiday.category?.charAt(0).toUpperCase() + holiday.category?.slice(1);

  return (
    <button
      className="generalCard cardPaddingSmall publicHolidayCard"
      onClick={onClick}
    >
      <div className="publicHolidayCardHeader">
        <div className="publicHolidayCardHeaderLeft">
          <IconCard
            name={formatDate(holiday.holiday_date)}
            style="blue textXXS textBold"
          />
          <IconCard icon={TagIcon} name={holiday.code} style="grey textXXXS" />
        </div>
        <IconCard
          name={categoryLabel}
          style={`${CATEGORY_STYLE[holiday.category] || "grey"} textXXS`}
        />
      </div>

      <div className="publicHolidayCardFooter">
        <p
          className="textBold textS publicHolidayCardName"
          title={holiday.name}
        >
          {holiday.name}
        </p>
        <IconCard
          icon={MapPinIcon}
          name={holiday.work_location?.name || "All Locations"}
          style="blue textXXXS"
        />
      </div>
    </button>
  );
}

export default PublicHolidayCard;
