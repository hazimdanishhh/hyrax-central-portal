// components/attendance/payrollReconciliationSidebar/PayrollReconciliationSidebar.jsx
import { Link } from "react-router";
import {
  CaretRightIcon,
  PaperPlaneTiltIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import Button from "../../buttons/button/Button";
import LoadingIcon from "../../loadingIcon/LoadingIcon";
import usePayrollReconciliationDetail from "../../../features/hr/payroll/private/hooks/usePayrollReconciliationDetail";
import usePayrollReconciliationGlossary from "../../../features/hr/payroll/private/hooks/usePayrollReconciliationGlossary";
import usePayrollReconciliationLastSend from "../../../features/hr/payroll/private/hooks/usePayrollReconciliationLastSend";
import usePayrollReconciliationEmailMutations from "../../../features/hr/payroll/private/hooks/usePayrollReconciliationEmailMutations";
import {
  formatDate,
  formatDateTime,
  formatTime,
} from "../../../functions/formatDate";
import {
  buildHrAttendanceListLink,
  buildAttendanceDayLink,
} from "../../../functions/payrollReconciliationLinks";
import { getPayrollSummaryKpiCards } from "../../../pages/user/hr/attendanceManagement/payrollExport/kpiCardConfig";
import "./PayrollReconciliationSidebar.scss";
import { useTheme } from "../../../context/ThemeContext";
import EmployeeImage from "../../employees/employeeImage/EmployeeImage";
import AttendanceCard from "../attendanceCard/AttendanceCard";
import CardLayout from "../../cardLayout/CardLayout";
import RouterButton from "../../buttons/routerButton/RouterButton";

// Maps one get_payroll_reconciliation_rows() row into the snake_case shape
// AttendanceCard already expects (see attendanceOverviewService.js's
// normalizeUnifiedAttendance -- this mirrors its field names exactly, just
// sourced from the RPC's camelCase JSON instead of a raw table row).
// is_leave_attendance_conflict/is_insufficient_half_day_hours/
// has_leave_fraction_error are derived from `category` itself rather than
// carried separately -- each row already IS one specific category, so this
// correctly highlights only the flag that earned it a place in THIS section
// rather than every flag that happens to apply to that day.
function toAttendanceCardActivity(row, { employeeUuid, employeeName }) {
  return {
    id: employeeUuid,
    full_name: employeeName,
    work_date: formatDate(row.workDate),
    hr_flag: row.hrFlag,
    is_weekend: row.isWeekend,
    daily_activities: row.dailyActivities,
    is_on_leave: Boolean(row.leaveTypeCodes),
    leave_type_codes: row.leaveTypeCodes,
    first_in_time: formatTime(row.firstIn),
    last_out_time: formatTime(row.lastOut),
    overtime_hours: row.overtimeHours,
    is_early_leave: row.isEarlyLeave,
    is_late_arrival: row.isLateArrival,
    is_leave_attendance_conflict: row.category === "leave_conflict",
    is_insufficient_half_day_hours: row.category === "insufficient_half_day",
    has_leave_fraction_error: row.category === "leave_fraction_error",
    is_worked_on_holiday: row.isWorkedOnHoliday,
    holiday_hours_worked: row.holidayHoursWorked,
  };
}

// Fixed display order, matching the Payroll Export table's own column order
// (Days Absent, Leave Conflicts, Insufficient Half-Day Hours, Leave Data
// Errors) 1:1, and get_payroll_reconciliation_rows()/
// queue_payroll_reconciliation_email_rpc.sql's own v_category_order --
// every consumer of these 4 categories agrees on the same order everywhere.
const SECTIONS = [
  { code: "absent", tableColumnKey: "daysAbsentCount" },
  { code: "leave_conflict", tableColumnKey: "leaveAttendanceConflictCount" },
  {
    code: "insufficient_half_day",
    tableColumnKey: "insufficientHalfDayHoursCount",
  },
  { code: "leave_fraction_error", tableColumnKey: "leaveFractionErrorCount" },
];

/**
 * Read-only row-click drilldown for one employee's Payroll Export row --
 * rendered inside <DataSidebar isEditing={false}>, so this owns everything
 * below the sidebar's own header/close-button chrome. Breaks the row's 4
 * reconciliation counts down into the actual flagged dates, with a
 * plain-English explanation of each (from payroll_reconciliation_glossary,
 * the same table queue_payroll_reconciliation_email_rpc.sql reads when it
 * composes the emailed version of this same list), and a single-click
 * "Send Email" that queues one consolidated email to the employee via the
 * existing async email_queue/send-queued-emails pipeline.
 */
export default function PayrollReconciliationSidebar({
  row,
  employeeUuid,
  employeeName,
  resolvedEmail,
  emailSource,
  startDate,
  endDate,
}) {
  const { darkMode } = useTheme();
  const { rows, isLoading } = usePayrollReconciliationDetail({
    employeeUuid,
    startDate,
    endDate,
  });
  const { glossaryByCode } = usePayrollReconciliationGlossary();
  const { lastSend } = usePayrollReconciliationLastSend({
    employeeUuid,
    startDate,
    endDate,
  });
  const { queuePayrollReconciliationEmail, queuing } =
    usePayrollReconciliationEmailMutations();

  const handleSendEmail = () => {
    queuePayrollReconciliationEmail({ employeeUuid, startDate, endDate });
  };

  return (
    <div className="payrollReconciliationSidebar">
      <div className="payrollReconciliationSidebarHeader">
        <div className="payrollReconciliationSidebarName">
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <EmployeeImage
              employeeId={employeeUuid}
              showName={false}
              setShowName={() => {}}
            />
            <p className="textBold textS">{employeeName}</p>
          </div>
          <p className="textRegular textS">
            {formatDate(startDate)} — {formatDate(endDate)}
          </p>
        </div>

        {resolvedEmail ? (
          <p className="textRegular textXS">
            Will email: <span className="textBold">{resolvedEmail}</span> (
            {emailSource === "work" ? "work email" : "personal email"})
          </p>
        ) : (
          <p className="textRegular textXS payrollReconciliationNoEmail">
            <WarningCircleIcon size={16} />
            No work or personal email on file — add one in Employee Management
            before sending.
          </p>
        )}
      </div>

      {/* SUMMARY KPI CARDS -- every row field except the 4 reconciliation
          counts below (those get their own richer section, with actual
          attendance cards). Each links to the matching Attendance List
          filter in a new tab, so HR can manually verify a number without
          losing their place in this sidebar. */}
      {row && (
        <div className="payrollSummaryKpiGroups">
          {getPayrollSummaryKpiCards(row, { startDate, endDate }).map(
            (group) => (
              <div key={group.groupLabel} className="payrollSummaryKpiGroup">
                <p className="textBold textXXS payrollSummaryKpiGroupLabel">
                  {group.groupLabel}
                </p>
                <div className="payrollSummaryKpiGrid">
                  {group.cards.map((card) => {
                    const Wrapper = card.link ? "a" : "div";
                    const wrapperProps = card.link
                      ? {
                          href: card.link,
                          target: "_blank",
                          rel: "noopener noreferrer",
                        }
                      : {};

                    return (
                      <Wrapper
                        key={card.label}
                        {...wrapperProps}
                        title={card.description}
                        className={`payrollSummaryKpiCard generalCard${card.link ? " payrollSummaryKpiCardLink" : ""}`}
                      >
                        <p className="textXXS textLight">{card.label}</p>
                        <p className="textBold textS">{card.value}</p>
                      </Wrapper>
                    );
                  })}
                </div>
              </div>
            ),
          )}
        </div>
      )}

      {isLoading ? (
        <LoadingIcon />
      ) : (
        <div className="payrollReconciliationSidebarSections">
          {SECTIONS.map((section) => {
            const glossaryEntry = glossaryByCode[section.code];
            const sectionRows = rows.filter(
              (detailRow) => detailRow.category === section.code,
            );

            return (
              <div
                key={section.code}
                className="payrollReconciliationSection generalCard"
              >
                <p className="textBold textS">
                  {glossaryEntry?.label || section.code}{" "}
                  <span className="textRegular textXXS">
                    ({sectionRows.length} days)
                  </span>
                </p>

                {glossaryEntry?.description && (
                  <p className="textRegular textXS">
                    {glossaryEntry.description}
                  </p>
                )}

                {sectionRows.length === 0 ? (
                  <p className="textRegular textXS payrollReconciliationClear">
                    None — all clear.
                  </p>
                ) : (
                  <>
                    <CardLayout style="cardLayout1 cardGapSmall">
                      {sectionRows.map((sectionRow) => (
                        <AttendanceCard
                          key={`${sectionRow.category}-${sectionRow.workDate}`}
                          activity={toAttendanceCardActivity(sectionRow, {
                            employeeUuid,
                            employeeName,
                          })}
                          // `to`, not `onClick` -- AttendanceCard's signature
                          // is ({activity, to, target, rel}) and silently
                          // dropped the onClick this used to pass, so these
                          // cards were dead. And now it opens THAT DAY's
                          // sidebar directly rather than a single-day filtered
                          // list the user still had to click through --
                          // sectionRow.workDate is the raw ISO date (the
                          // formatted copy lives inside
                          // toAttendanceCardActivity, a few lines up).
                          to={
                            buildAttendanceDayLink({
                              employeeUuid,
                              workDate: sectionRow.workDate,
                            }) || undefined
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                        />
                      ))}
                    </CardLayout>
                    {glossaryEntry?.employee_action_text && (
                      <p className="textRegular textXS payrollReconciliationAction">
                        {glossaryEntry.employee_action_text}
                      </p>
                    )}
                    <RouterButton
                      to={buildHrAttendanceListLink({
                        employeeUuid,
                        code: section.code,
                        startDate,
                        endDate,
                      })}
                      style="textRegular textXXS button buttonType4"
                      icon={CaretRightIcon}
                      name={`View all ${sectionRows.length} day${sectionRows.length === 1 ? "" : "s"} in Attendance List`}
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div
        className={`payrollReconciliationSidebarFooter${darkMode ? " sectionDark" : " sectionLight"}`}
      >
        <Button
          name={queuing ? "Queuing..." : "Send Email"}
          icon={PaperPlaneTiltIcon}
          style="button buttonType5 approval"
          disabled={!resolvedEmail || queuing}
          onClick={handleSendEmail}
        />

        {lastSend && (
          <p className="textRegular textXXS">
            Last requested: {formatDateTime(lastSend.queued_at)}
            {lastSend.queuedByEmployee?.full_name
              ? ` by ${lastSend.queuedByEmployee.full_name}`
              : ""}
          </p>
        )}
      </div>
    </div>
  );
}
