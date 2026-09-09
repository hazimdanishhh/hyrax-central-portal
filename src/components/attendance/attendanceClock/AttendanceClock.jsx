import { SignOutIcon, SignInIcon } from "@phosphor-icons/react";
import "./AttendanceClock.scss";

/**
 * `type` is just "clockin" | "clockout" ("in"/"out" kept as harmless
 * aliases, though no caller in this codebase currently uses them). Whether
 * to highlight this chip as an anomaly (late arrival on a clock-in chip,
 * early leave on a clock-out chip) is a SEPARATE explicit boolean,
 * `isAnomaly` -- not encoded into `type` itself. Concatenating it into
 * `type` (e.g. `clockin ${isLate ? "late" : ""}`) is a real footgun: the
 * false branch produces "clockin " (a trailing space), which silently
 * fails every exact-string match below -- breaking the prefix text, color,
 * AND icon for the non-anomaly case, not just the styling.
 */
export default function AttendanceClock({ time, type, isAnomaly = false }) {
  const isClockIn = type === "clockin" || type === "in";
  const isClockOut = type === "clockout" || type === "out";

  const prefix = isClockIn ? "First In: " : isClockOut ? "Last Seen: " : "";

  const colorClass = isAnomaly ? "red" : isClockOut ? "yellow" : "green";

  const IconComponent = isClockOut ? SignOutIcon : SignInIcon;

  return (
    <div className={`attendanceCardClock ${colorClass}`}>
      <p className="textBold textXXS">
        {prefix}
        {time}
      </p>

      <div className="attendanceCardIcon">
        <IconComponent weight="bold" size={12} />
      </div>
    </div>
  );
}
