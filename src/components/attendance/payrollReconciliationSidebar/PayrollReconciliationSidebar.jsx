// components/attendance/payrollReconciliationSidebar/PayrollReconciliationSidebar.jsx
import { Link } from "react-router";
import { PaperPlaneTiltIcon, WarningCircleIcon } from "@phosphor-icons/react";
import Button from "../../buttons/button/Button";
import LoadingIcon from "../../loadingIcon/LoadingIcon";
import usePayrollReconciliationDetail from "../../../features/hr/payroll/private/hooks/usePayrollReconciliationDetail";
import usePayrollReconciliationGlossary from "../../../features/hr/payroll/private/hooks/usePayrollReconciliationGlossary";
import usePayrollReconciliationLastSend from "../../../features/hr/payroll/private/hooks/usePayrollReconciliationLastSend";
import usePayrollReconciliationEmailMutations from "../../../features/hr/payroll/private/hooks/usePayrollReconciliationEmailMutations";
import { formatDate, formatDateTime } from "../../../functions/formatDate";
import { buildHrAttendanceListLink } from "../../../functions/payrollReconciliationLinks";
import "./PayrollReconciliationSidebar.scss";
import { useTheme } from "../../../context/ThemeContext";
import EmployeeImage from "../../employees/employeeImage/EmployeeImage";

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

      {isLoading ? (
        <LoadingIcon />
      ) : (
        <div className="payrollReconciliationSidebarSections">
          {SECTIONS.map((section) => {
            const glossaryEntry = glossaryByCode[section.code];
            const sectionRows = rows.filter(
              (row) => row.category === section.code,
            );

            return (
              <div
                key={section.code}
                className="payrollReconciliationSection generalCard"
              >
                <p className="textBold textS">
                  {glossaryEntry?.label || section.code}
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
                    <ul className="payrollReconciliationDateList">
                      {sectionRows.map((row) => (
                        <li key={`${row.category}-${row.workDate}`}>
                          {formatDate(row.workDate)}
                        </li>
                      ))}
                    </ul>
                    {glossaryEntry?.employee_action_text && (
                      <p className="textRegular textXS payrollReconciliationAction">
                        {glossaryEntry.employee_action_text}
                      </p>
                    )}
                    <Link
                      to={buildHrAttendanceListLink({
                        employeeUuid,
                        code: section.code,
                        startDate,
                        endDate,
                      })}
                      className="textRegular textXXS payrollReconciliationDeepLink"
                    >
                      View these {sectionRows.length} day
                      {sectionRows.length === 1 ? "" : "s"} in Attendance List
                      &rarr;
                    </Link>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="payrollReconciliationFooterGap"></div>

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
