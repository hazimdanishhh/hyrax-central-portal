import { useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence } from "framer-motion";
import {
  CalendarPlusIcon,
  ClockUserIcon,
  FingerprintSimpleIcon,
} from "@phosphor-icons/react";
import DataSidebar from "../dataSidebar/DataSidebar";
import ClockInSidebar from "../attendanceActivityClockin/clockInSidebar/ClockInSidebar";
import AttendanceSubmissionSidebar from "../attendance/attendanceSubmission/AttendanceSubmissionSidebar";
import AttendanceType from "../attendance/attendanceType/AttendanceType";
import AttendanceClock from "../attendance/attendanceClock/AttendanceClock";
import { useEmployee } from "../../context/EmployeeContext";
import useClockInOutAction from "../../features/employee/attendance/private/hooks/useClockInOutAction";

/**
 * BottomTabBar's attendance button (2026-10-22). Opens a small chooser
 * between the app's two ways of recording attendance, then the SAME form
 * each one uses everywhere else:
 *
 *   Live    -- Clock In now (remote work, one open session) or Clock Out:
 *              useClockInOutAction + ClockInSidebar, exactly as ClockinMini
 *              and the Dashboard fingerprint button.
 *   Add     -- Add Activities (one or more, past or planned):
 *              AttendanceSubmissionSidebar in "self" scope, exactly as the
 *              Dashboard's "Add Activities" button.
 *
 * The chooser is also why Clock Out needs no separate confirmation here:
 * reaching it already takes a deliberate second tap, so a stray thumb on the
 * bar can't end a session.
 *
 * Everything is portalled into document.body: the bar's backdrop-filter
 * would otherwise trap these fixed-position sidebars inside the 60px bar.
 */
export default function BottomTabClockIn() {
  const { employee } = useEmployee();
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
  const [chooserOpen, setChooserOpen] = useState(false);
  const [activitiesOpen, setActivitiesOpen] = useState(false);

  const clockedIn = Boolean(currentActivity);

  function chooseLive() {
    setChooserOpen(false);
    openClockIn();
  }

  async function chooseClockOut() {
    await handleClockOut();
    setChooserOpen(false);
  }

  function chooseAddActivities() {
    setChooserOpen(false);
    setActivitiesOpen(true);
  }

  return (
    <>
      <button
        type="button"
        className={`bottomTabLink bottomTabClock ${
          clockedIn ? "clockedIn" : "clockedOut"
        }`}
        onClick={() => setChooserOpen(true)}
        aria-haspopup="dialog"
      >
        <span className="bottomTabIcon">
          <ClockUserIcon size={24} weight="fill" />
          {clockedIn && (
            <span className="bottomTabLiveDot" aria-hidden="true" />
          )}
        </span>
        <span className="textXXXS textBold">
          {clockedIn ? "Clock Out" : "Clock In"}
        </span>
      </button>

      {createPortal(
        <>
          {/* THE CHOOSER */}
          <AnimatePresence>
            {chooserOpen && (
              <DataSidebar
                title="Attendance"
                icon={ClockUserIcon}
                open={chooserOpen}
                onClose={() => setChooserOpen(false)}
                isEditing={false}
              >
                <div className="clockChooser">
                  {clockedIn && (
                    <div className="clockChooserStatus generalCard">
                      <AttendanceType
                        attendanceType={currentActivity.attendance_type?.name}
                      />
                      <AttendanceClock
                        time={currentActivity.clocked_in_time}
                        type="clockin"
                      />
                    </div>
                  )}

                  {clockedIn ? (
                    <button
                      type="button"
                      className="clockChooserOption clockOut"
                      onClick={chooseClockOut}
                      disabled={saving}
                    >
                      <FingerprintSimpleIcon size={32} />
                      <span className="clockChooserText">
                        <span className="textS textBold">
                          {saving ? "Clocking out…" : "Clock Out"}
                        </span>
                        <span className="textXXS textLight">
                          End your live session now
                        </span>
                      </span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="clockChooserOption clockIn"
                      onClick={chooseLive}
                    >
                      <FingerprintSimpleIcon size={32} />
                      <span className="clockChooserText">
                        <span className="textS textBold">Clock In now</span>
                        <span className="textXXS textLight">
                          Start a live session for remote work
                        </span>
                      </span>
                    </button>
                  )}

                  <button
                    type="button"
                    className="clockChooserOption"
                    onClick={chooseAddActivities}
                  >
                    <CalendarPlusIcon size={32} />
                    <span className="clockChooserText">
                      <span className="textS textBold">Add Activities</span>
                      <span className="textXXS textLight">
                        Record one or more activities, past or planned
                      </span>
                    </span>
                  </button>
                </div>
              </DataSidebar>
            )}
          </AnimatePresence>

          {/* LIVE: the same clock-in form as ClockinMini / the Dashboard */}
          <ClockInSidebar
            sidebarOpen={sidebarOpen}
            attendanceTypesLoading={attendanceTypesLoading}
            columns={columns}
            closeClockIn={closeClockIn}
            handleClockIn={handleClockIn}
            saving={saving}
          />

          {/* ADD: the same form as the Dashboard's "Add Activities" */}
          <AttendanceSubmissionSidebar
            open={activitiesOpen}
            onClose={() => setActivitiesOpen(false)}
            scope="self"
            currentEmployeeId={employee?.id}
          />
        </>,
        document.body,
      )}
    </>
  );
}
