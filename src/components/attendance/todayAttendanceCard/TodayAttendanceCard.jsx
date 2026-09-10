// components/attendance/todayAttendanceCard/TodayAttendanceCard.jsx

import { AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
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
import AttendanceDayTimelineBar from "@/components/attendance/attendanceDayTimelineBar/AttendanceDayTimelineBar";
import AttendanceTimelineCard from "@/components/attendance/attendanceSidebarHR/attendanceTimelineCard/AttendanceTimelineCard";
import AttendanceAnomalyBadges from "@/components/attendance/attendanceAnomalyBadges/AttendanceAnomalyBadges";
import StatusBox from "@/components/status/statusBox/StatusBox";
import getHrFlagStatusType from "@/functions/attendanceFlagStatus";
import useElapsedSince from "@/functions/useElapsedSince";
import { useEmployee } from "@/context/EmployeeContext";
import { fetchEmployeeDayDetails } from "@/features/hr/attendance/private/api/attendanceOverviewService";
import useMyAttendanceThisWeek from "@/features/employee/attendance/private/hooks/useMyAttendanceThisWeek";
import useMyCurrentStatus from "@/features/employee/attendance/private/hooks/useMyCurrentStatus";
import useClockInOutAction from "@/features/employee/attendance/private/hooks/useClockInOutAction";
import "./TodayAttendanceCard.scss";

function todayISODate() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

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
  const { employee } = useEmployee();

  const { today, chartData, totalHoursThisWeek, isLoading } =
    useMyAttendanceThisWeek();

  // "Today's Activity" -- reuses the exact same fetch AttendanceSidebarHR
  // makes for its own per-day timeline, since unified_daily_attendance (the
  // source for `today` above) already collapses every scanner location
  // into one combined span before this card ever sees it -- there's no
  // per-location breakdown to show without this separate call.
  const todayISO = todayISODate();
  const { data: todayDetails, isLoading: todayDetailsLoading } = useQuery({
    queryKey: ["my_attendance_day_details", employee?.id, todayISO],
    queryFn: () => fetchEmployeeDayDetails(employee?.id, todayISO),
    enabled: Boolean(employee?.id),
  });

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

  const elapsedSinceClockIn = useElapsedSince(
    currentActivity?.clocked_in_at_raw,
  );

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
                  {/* Mirrors AttendanceSidebarHR's layout order (status
                      chips -> day timeline bar -> clocks -> hours worked +
                      badges -> Activity Timeline), so the same day looks
                      the same whether HR opens it from the List sidebar or
                      the employee sees it here on their own Dashboard. */}
                  <div className="todayAttendanceChips">
                    {currentStatus && (
                      <AttendanceType attendanceType={currentStatus} />
                    )}
                    {isOnLeaveToday &&
                      !currentStatus?.startsWith("On Leave") && (
                        <AttendanceType
                          attendanceType={`On Leave (${leaveTypeCodesToday})`}
                        />
                      )}
                    {today?.hr_flag && (
                      <StatusBox
                        status={today.hr_flag}
                        type={getHrFlagStatusType(today.hr_flag)}
                      />
                    )}
                  </div>

                  <AttendanceDayTimelineBar timelineData={todayDetails || []} />

                  {(today?.first_in_time || today?.last_out_time) && (
                    <div className="todayAttendanceClockWrapper">
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
                    </div>
                  )}

                  {today?.hours_worked != null && (
                    <div className="todayAttendanceHoursRow">
                      <p className="textBold textS">
                        {today.hours_worked}h worked
                      </p>
                      <AttendanceAnomalyBadges
                        overtimeHours={today?.overtime_hours}
                        isEarlyLeave={today?.is_early_leave}
                        isLateArrival={today?.is_late_arrival}
                        isLeaveAttendanceConflict={
                          today?.is_leave_attendance_conflict
                        }
                        isInsufficientHalfDayHours={
                          today?.is_insufficient_half_day_hours
                        }
                        hasLeaveFractionError={today?.has_leave_fraction_error}
                        isWorkedOnHoliday={today?.is_worked_on_holiday}
                        holidayHoursWorked={today?.holiday_hours_worked}
                      />
                    </div>
                  )}

                  {currentActivity && (
                    <p className="textLight textXXS">
                      Clocked in remote: {currentActivity.attendance_type?.name}{" "}
                      · since {currentActivity.clocked_in_time} ·{" "}
                      {elapsedSinceClockIn} ago
                    </p>
                  )}

                  <div className="divider"></div>

                  {/* Read-only -- mode="readonly" matches none of
                      AttendanceTimelineCard's existing hr/self/manager
                      gates, so no clock-out/approve/edit buttons render;
                      the card's own fingerprint button below already
                      handles clocking in/out. */}
                  <div className="todayActivityTimeline">
                    <p className="textBold textXS">Today's Activity</p>
                    {todayDetailsLoading ? (
                      <LoadingIcon />
                    ) : !todayDetails || todayDetails.length === 0 ? (
                      <p className="textLight textXXS">
                        No activity logged yet today.
                      </p>
                    ) : (
                      todayDetails.map((activity) => (
                        <AttendanceTimelineCard
                          key={activity.activity_id}
                          activity={activity}
                          mode="readonly"
                        />
                      ))
                    )}
                  </div>
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
