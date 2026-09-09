import React from "react";
import "./AttendanceType.scss";

import { CalendarXIcon, BuildingOfficeIcon } from "@phosphor-icons/react";
import { ATTENDANCE_TYPE_CONFIG } from "./attendanceTypeConfig";

// ATTENDANCE TYPE COMPONENT WITH ICONS
function AttendanceType({ attendanceType = "" }) {
  const type = attendanceType.toLowerCase().trim();

  // HR2000 leave ledger integration -- current_status/hr_flag values like
  // "On Leave (AL)" carry a dynamic type suffix, so they can't be matched by
  // the exact-string config map above. Checked before it so any leave-type
  // suffix gets consistent icon/color treatment while keeping the specific
  // type visible in the label.
  const selected = type.startsWith("on leave")
    ? { icon: CalendarXIcon, label: attendanceType, className: "purple" }
    : ATTENDANCE_TYPE_CONFIG[type] || {
        icon: BuildingOfficeIcon,
        className: "default",
        label: attendanceType,
      };

  const Icon = selected.icon;

  return (
    <div className={`attendanceTypeContainer ${selected.className}`}>
      <p className="textRegular textXXS">{selected.label}</p>
      <Icon size={14} weight="fill" />
    </div>
  );
}

export default AttendanceType;
