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

// Type -> {icon, label, className} map, shared by AttendanceType.jsx (the
// pill component) and anything else needing the same icon/color vocabulary
// (e.g. AttendanceDayTimelineBar) -- kept in its own file, not exported
// alongside the component, since a file mixing a component export with a
// plain-value export breaks React Fast Refresh (react-refresh/only-export-
// components).
export const ATTENDANCE_TYPE_CONFIG = {
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
