import React from "react";
import "./AttendanceType.scss";

import {
  BuildingOfficeIcon,
  FactoryIcon,
  MapPinIcon,
  BriefcaseIcon,
  HouseIcon,
  GraduationCapIcon,
  AlarmIcon,
  SignOutIcon,
  UserCircleDashedIcon,
} from "@phosphor-icons/react";

// ATTENDANCE TYPE COMPONENT WITH ICONS
function AttendanceType({ attendanceType = "" }) {
  const type = attendanceType.toLowerCase().trim();

  const config = {
    office: {
      icon: BuildingOfficeIcon,
      label: "Office",
      className: "green",
    },
    "offline / not arrived": {
      icon: UserCircleDashedIcon,
      label: "Absent",
      className: "grey",
    },
    offline: {
      icon: UserCircleDashedIcon,
      label: "Offline",
      className: "red",
    },
    "blending plant": {
      icon: FactoryIcon,
      label: "Blending Plant",
      className: "green",
    },
    "site visit": {
      icon: MapPinIcon,
      label: "Site Visit",
      className: "blue",
    },
    "business meeting": {
      icon: BriefcaseIcon,
      label: "Business Meeting",
      className: "blue",
    },
    "work from home": {
      icon: HouseIcon,
      label: "Work From Home",
      className: "yellow",
    },
    training: {
      icon: GraduationCapIcon,
      label: "Training",
      className: "yellow",
    },
    overtime: {
      icon: AlarmIcon,
      label: "Overtime",
      className: "red",
    },
    "not in office": {
      icon: SignOutIcon,
      label: "Not In Office",
      className: "red",
    },
  };

  const selected = config[type] || {
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
