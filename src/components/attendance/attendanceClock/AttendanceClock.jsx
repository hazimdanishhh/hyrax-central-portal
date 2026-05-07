import { SignInIcon, SignOutIcon } from "@phosphor-icons/react";
import React from "react";

function AttendanceClock({ time, type }) {
  return (
    <div
      className={
        type === "clockin"
          ? "attendanceCardClock green"
          : type === "clockout"
            ? "attendanceCardClock yellow"
            : "attendanceCardClock green"
      }
    >
      <p className="textBold textXXS">{time}</p>
      <div className="attendanceCardIcon">
        {type === "clockin" ? (
          <SignInIcon weight="bold" size={12} />
        ) : (
          <SignOutIcon weight="bold" size={12} />
        )}
      </div>
    </div>
  );
}

export default AttendanceClock;
