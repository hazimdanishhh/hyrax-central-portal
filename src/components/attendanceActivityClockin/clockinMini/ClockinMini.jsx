// components/attendanceActivityClockin/clockinMini/ClockinMini.jsx

import { ClockUserIcon } from "@phosphor-icons/react";
import Button from "../../buttons/button/Button";
import CardLayout from "../../cardLayout/CardLayout";
import ClockInSidebar from "../clockInSidebar/ClockInSidebar";
import AttendanceType from "../../attendance/attendanceType/AttendanceType";
import AttendanceClock from "../../attendance/attendanceClock/AttendanceClock";
import useMyCurrentStatus from "../../../features/employee/attendance/private/hooks/useMyCurrentStatus";
import useClockInOutAction from "../../../features/employee/attendance/private/hooks/useClockInOutAction";

export default function ClockinMini({ navIsOpen }) {
  const { currentStatus, firstArrivalTime, lastStatusTime } =
    useMyCurrentStatus();

  const {
    currentActivity,
    columns,
    attendanceTypesLoading,
    sidebarOpen,
    openClockIn,
    closeClockIn,
    handleClockIn,
    handleClockOut,
    saving,
  } = useClockInOutAction();

  return (
    <>
      {/* ATTENDANCE ACTIVITY BUTTON */}
      {currentActivity ? (
        <Button
          style="button buttonType2Clockout textBold textXXS"
          icon={ClockUserIcon}
          name={navIsOpen ? "Clock Out" : null}
          title={navIsOpen ? undefined : "Clock Out"}
          onClick={handleClockOut}
        />
      ) : (
        <Button
          style="button buttonType2Clockin textBold textXXS"
          icon={ClockUserIcon}
          name={navIsOpen ? "Clock In" : null}
          title={navIsOpen ? undefined : "Clock In"}
          onClick={openClockIn}
        />
      )}

      {/* CURRENT STATUS -- an open app session is the most authoritative
          "right now" signal, shown as before. Otherwise, currentStatus
          (employees_public.current_status) already combines whichever of
          {open app session, most recent biometric scan, approved leave}
          happened most recently today -- the same hybrid signal the
          Dashboard's TodayAttendanceCard shows, so nav and dashboard never
          disagree. */}
      {navIsOpen && currentActivity ? (
        <CardLayout key={currentActivity.id} style="cardLayout1">
          <CardLayout style="cardLayoutFlexFull generalCard">
            <AttendanceType
              attendanceType={currentActivity.attendance_type?.name}
            />
            <AttendanceClock
              time={currentActivity.clocked_in_time}
              type="clockin"
            />
          </CardLayout>
        </CardLayout>
      ) : navIsOpen && currentStatus ? (
        <CardLayout style="cardLayout1">
          <CardLayout style="cardLayoutFlexFull generalCard">
            <AttendanceType attendanceType={currentStatus} />
            {/* Full cycle, matching AttendanceSidebarHR's First In/Last Out
                pair -- lastStatusTime is the most recent event (possibly
                the 3rd, 4th, ... scan of the day), not a first arrival, so
                it must be type="clockout" ("Last Seen:"), not "clockin"
                ("First In:") -- both used to be mislabeled "clockin" here,
                so a day with several scans only ever showed "First In" and
                never the actual last-seen time. */}
            {firstArrivalTime && (
              <AttendanceClock time={firstArrivalTime} type="clockin" />
            )}
            {lastStatusTime && (
              <AttendanceClock time={lastStatusTime} type="clockout" />
            )}
          </CardLayout>
        </CardLayout>
      ) : null}

      {/* DATASIDEBAR -- shared with BottomTabBar's clock button, portalled */}
      <ClockInSidebar
        sidebarOpen={sidebarOpen}
        attendanceTypesLoading={attendanceTypesLoading}
        columns={columns}
        closeClockIn={closeClockIn}
        handleClockIn={handleClockIn}
        saving={saving}
      />
    </>
  );
}
