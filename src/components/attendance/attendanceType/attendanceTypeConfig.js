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
  AirplaneTiltIcon,
  CarProfileIcon,
  ConfettiIcon,
  SteeringWheelIcon,
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

  // Business trips -- two separate types, not one, because their weekend
  // allowance rules genuinely differ (overseas weekend = 2x daily allowance;
  // local weekend = 1 day Replacement Leave instead). See
  // docs/hr/OVERTIME-WEEKEND-HOLIDAY-CLAIMS-DESIGN.md. Blue matches the other
  // away-from-site-but-working types (Site Visit, Business Meeting).
  "overseas trip": {
    icon: AirplaneTiltIcon,
    label: "Overseas Trip",
    className: "blue",
  },
  "local trip": {
    icon: CarProfileIcon,
    label: "Local Trip",
    className: "blue",
  },

  // Attended work that is neither instruction (Training) nor client-facing
  // (Site Visit) -- annual dinner, townhall, team building, CSR day.
  "company event": {
    icon: ConfettiIcon,
    label: "Company Event",
    className: "yellow",
  },

  // Lorry drivers and company/personal drivers. The door scanners are access
  // control, not time clocks, so driving time is invisible to them every day
  // rather than occasionally -- this is a standing type, not an anomaly.
  "driving duty": {
    icon: SteeringWheelIcon,
    label: "Driving Duty",
    className: "yellow",
  },
};
