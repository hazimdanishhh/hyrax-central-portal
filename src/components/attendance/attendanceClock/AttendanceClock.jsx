import {
  BuildingOfficeIcon,
  SignInIcon,
  SignOutIcon,
} from "@phosphor-icons/react";
import React from "react";
import "./AttendanceClock.scss";

function AttendanceClock({ time, type }) {
  return (
    <div
      className={
        type === "clockin" || type === "in"
          ? "attendanceCardClock green"
          : type === "out" || type === "clockout"
            ? "attendanceCardClock yellow"
            : type === "late"
              ? "attendanceCardClock red"
              : "attendanceCardClock green"
      }
    >
      <p className="textBold textXXS">{time}</p>
      <div className="attendanceCardIcon">
        {type === "clockin" || type === "late" ? (
          <SignInIcon weight="bold" size={12} />
        ) : type === "out" || type === "in" ? (
          <BuildingOfficeIcon weight="bold" size={12} />
        ) : (
          <SignOutIcon weight="bold" size={12} />
        )}
      </div>
    </div>
  );
}

export default AttendanceClock;
