// components/attendanceActivityClockin/clockinMini/ClockinMini.jsx

import { AnimatePresence } from "framer-motion";
import { CalendarDotsIcon, ClockUserIcon } from "@phosphor-icons/react";
import Button from "../../buttons/button/Button";
import DataSidebar from "../../dataSidebar/DataSidebar";
import LoadingIcon from "../../loadingIcon/LoadingIcon";
import CardLayout from "../../cardLayout/CardLayout";
import AttendanceType from "../../attendance/attendanceType/AttendanceType";
import AttendanceClock from "../../attendance/attendanceClock/AttendanceClock";
import useMyCurrentStatus from "../../../features/employee/attendance/private/hooks/useMyCurrentStatus";
import useClockInOutAction from "../../../features/employee/attendance/private/hooks/useClockInOutAction";

export default function ClockinMini({ navIsOpen }) {
  const { currentStatus, lastStatusTime } = useMyCurrentStatus();

  const {
    currentActivity,
    columns,
    attendanceTypesLoading,
    sidebarOpen,
    openClockIn,
    closeClockIn,
    handleClockIn,
    handleClockOut,
  } = useClockInOutAction();

  return (
    <>
      {/* ATTENDANCE ACTIVITY BUTTON */}
      {currentActivity ? (
        <Button
          style="button buttonType2Clockout textBold textXXS"
          icon={ClockUserIcon}
          name={navIsOpen ? "Clock Out" : null}
          onClick={handleClockOut}
        />
      ) : (
        <Button
          style="button buttonType2Clockin textBold textXXS"
          icon={ClockUserIcon}
          name={navIsOpen ? "Clock In" : null}
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
            {lastStatusTime && (
              <AttendanceClock time={lastStatusTime} type="clockin" />
            )}
          </CardLayout>
        </CardLayout>
      ) : null}

      {/* DATASIDEBAR */}
      <AnimatePresence>
        {sidebarOpen &&
          (attendanceTypesLoading ? (
            <LoadingIcon />
          ) : (
            <DataSidebar
              title="Attendance Activity"
              icon={CalendarDotsIcon}
              open={sidebarOpen}
              onClose={closeClockIn}
              rowData={{}}
              columns={columns}
              onSave={handleClockIn}
              creating
            />
          ))}
      </AnimatePresence>
    </>
  );
}
