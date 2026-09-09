// components/attendance/todayAttendanceCard/TodayAttendanceCard.jsx

import { AnimatePresence } from "framer-motion";
import {
  CalendarDotsIcon,
  CaretRightIcon,
  ClockUserIcon,
  FingerprintSimpleIcon,
} from "@phosphor-icons/react";
import CardLayout from "@/components/cardLayout/CardLayout";
import PageHeader from "@/components/crud/pageHeader/PageHeader";
import SectionHeader from "@/components/sectionHeader/SectionHeader";
import RouterButton from "@/components/buttons/routerButton/RouterButton";
import Button from "@/components/buttons/button/Button";
import LoadingIcon from "@/components/loadingIcon/LoadingIcon";
import NoResult from "@/components/crud/noResult/NoResult";
import DataSidebar from "@/components/dataSidebar/DataSidebar";
import ChartCard from "@/components/chartCard/ChartCard";
import HorizontalBarChartRenderer from "@/components/chartCard/HorizontalBarChartRenderer";
import { GREEN_COLOR } from "@/components/chartCard/chartColors";
import AttendanceType from "@/components/attendance/attendanceType/AttendanceType";
import AttendanceClock from "@/components/attendance/attendanceClock/AttendanceClock";
import StatusBox from "@/components/status/statusBox/StatusBox";
import getHrFlagStatusType from "@/functions/attendanceFlagStatus";
import useElapsedSince from "@/functions/useElapsedSince";
import useMyAttendanceThisWeek from "@/features/employee/attendance/private/hooks/useMyAttendanceThisWeek";
import useMyCurrentStatus from "@/features/employee/attendance/private/hooks/useMyCurrentStatus";
import useClockInOutAction from "@/features/employee/attendance/private/hooks/useClockInOutAction";
import "./TodayAttendanceCard.scss";

const COMPLETION_REFERENCE_HOURS = 9;

/**
 * Home dashboard widget -- today's live status (currentStatus, from
 * employees_public, already combines whichever of {open app session, most
 * recent biometric scan, approved leave} happened most recently -- the only
 * source that can show a scanner-based "Office"/"Blending Plant" status,
 * since app clock-ins are remote-only now) plus a first-in/last-seen
 * completion bar and a simple hours-worked-this-week chart. Absolute route
 * paths below (not "../overview"-style relative ones) since this card
 * renders on Dashboard (/app), not under /app/employee/attendance/.
 */
export default function TodayAttendanceCard() {
  const { today, chartData, totalHoursThisWeek, isLoading } =
    useMyAttendanceThisWeek();

  const {
    currentStatus,
    isOnLeaveToday,
    leaveTypeCodesToday,
    isLoading: currentStatusLoading,
  } = useMyCurrentStatus();

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

  const elapsedSinceClockIn = useElapsedSince(currentActivity?.clocked_in_at_raw);

  // Completion bar -- fill proportional to elapsed time since first arrival
  // today, against a fixed reference work-day length. Sourced from
  // unified_daily_attendance's raw first_in/last_out (already fetched by
  // useMyAttendanceThisWeek) rather than employees_public's pre-formatted
  // time strings, since those aren't reliably re-parseable client-side.
  const firstInMs = today?.first_in ? new Date(today.first_in).getTime() : null;
  const lastOutMs = today?.last_out ? new Date(today.last_out).getTime() : null;
  const completionPct = firstInMs
    ? Math.min(
        100,
        Math.max(
          0,
          Math.round(
            ((lastOutMs ?? Date.now()) - firstInMs) /
              (COMPLETION_REFERENCE_HOURS * 60 * 60 * 1000) *
              100,
          ),
        ),
      )
    : 0;

  const hasAnyStatus = Boolean(today || currentStatus);

  return (
    <>
      <CardLayout style="">
        <PageHeader>
          <SectionHeader icon={ClockUserIcon} title="ATTENDANCE" />

          <div style={{ display: "flex", gap: "0.2rem" }}>
            <RouterButton
              name="Overview"
              to="/app/employee/attendance/overview"
              style="button buttonType5 textXXXS textBold"
              icon={CaretRightIcon}
            />
            <RouterButton
              name="History"
              to="/app/employee/attendance/list"
              style="button buttonType5 textXXXS textBold"
              icon={CaretRightIcon}
            />
          </div>
        </PageHeader>

        {isLoading || currentStatusLoading ? (
          <LoadingIcon />
        ) : (
          <CardLayout style="cardLayout2">
            <CardLayout style="generalCard todayAttendanceCard">
              <h2 className="textXL">Today's Attendance</h2>

              {!hasAnyStatus ? (
                <NoResult title="No attendance recorded yet today" />
              ) : (
                <>
                  <div className="todayAttendanceChips">
                    {currentStatus && (
                      <AttendanceType attendanceType={currentStatus} />
                    )}
                    {isOnLeaveToday && !currentStatus?.startsWith("On Leave") && (
                      <AttendanceType
                        attendanceType={`On Leave (${leaveTypeCodesToday})`}
                      />
                    )}
                    {today?.first_in_time && (
                      <AttendanceClock
                        time={today.first_in_time}
                        type="clockin"
                      />
                    )}
                    {today?.last_out_time && (
                      <AttendanceClock
                        time={today.last_out_time}
                        type="clockout"
                      />
                    )}
                    {today?.hr_flag && (
                      <StatusBox
                        status={today.hr_flag}
                        type={getHrFlagStatusType(today.hr_flag)}
                      />
                    )}
                  </div>

                  {firstInMs && (
                    <div className="todayCompletionBar">
                      <div className="todayCompletionBarTrack">
                        <div
                          className="todayCompletionBarFill"
                          style={{ width: `${completionPct}%` }}
                        />
                      </div>
                      <div className="todayCompletionBarLabels">
                        <span className="textXXXS textLight">
                          First In: {today.first_in_time}
                        </span>
                        <span className="textXXXS textLight">
                          {today.last_out_time
                            ? `Last Seen: ${today.last_out_time}`
                            : "Ongoing"}
                        </span>
                      </div>
                    </div>
                  )}

                  {currentActivity && (
                    <p className="textLight textXXS">
                      Clocked in remote: {currentActivity.attendance_type?.name}{" "}
                      · since {currentActivity.clocked_in_time} ·{" "}
                      {elapsedSinceClockIn} ago
                    </p>
                  )}
                </>
              )}

              <CardLayout style="cardLayoutFlexFull cardLayoutNoPadding">
                <Button
                  style={
                    currentActivity
                      ? "button buttonTypeClockout textBold textXXS"
                      : "button buttonTypeClockin textBold textXXS"
                  }
                  icon={FingerprintSimpleIcon}
                  size={64}
                  onClick={currentActivity ? handleClockOut : openClockIn}
                />
              </CardLayout>

              <p className="textLight textXS">
                Click the Fingerprint to Clock In/Out & Change Activity for
                Remote Work
              </p>
            </CardLayout>

            <ChartCard
              title="This Week"
              subtitle={`Total: ${totalHoursThisWeek.toFixed(1)}h, Mon–Today`}
              viewAllTo="/app/employee/attendance/list"
              style="cardGapSmall"
            >
              <HorizontalBarChartRenderer
                data={chartData}
                colorMap={GREEN_COLOR}
              />
            </ChartCard>
          </CardLayout>
        )}
      </CardLayout>

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
