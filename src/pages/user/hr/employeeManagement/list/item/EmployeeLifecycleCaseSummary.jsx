import { Link } from "react-router";
import CardLayout from "../../../../../../components/cardLayout/CardLayout";
import StatusBadge from "../../../../../../components/status/statusBadge/StatusBadge";
import ProgressBar from "../../../../../../components/progressBar/ProgressBar";
import { useOpenCasesForEmployee } from "../../../../../../features/employeeLifecycle/private/hooks/useOpenCasesForEmployee";
import {
  CASE_STATUSES,
  CASE_STATUS_TYPE,
  CASE_TYPE_LABEL,
} from "../../../../../../features/employeeLifecycle/private/lifecycleCaseStatusMeta";
import "./EmployeeLifecycleCaseSummary.scss";
import RouterButton from "../../../../../../components/buttons/routerButton/RouterButton";

/**
 * Sits alongside the existing EmployeeSidebar in EmployeeManagement.jsx's
 * DataSidebar `children` slot -- additive, not a rewrite. This is the
 * single most important integration point in
 * docs/EMPLOYEE-LIFECYCLE-CHECKLIST-ARCHITECTURE.md's "Employee Management
 * & IT Asset Management integration" section: without it, HR's own
 * Employee Management page -- the page HR actually uses daily -- would
 * show nothing about lifecycle-case status, and the new standalone pages
 * would just become a second place to remember to check.
 *
 * Renders ZERO, ONE, or TWO case blocks -- never assumes at most one.
 * Simultaneous onboarding + offboarding cases are a real, confirmed
 * scenario (not a rare edge case -- see the architecture doc), so this
 * must handle both existing at once cleanly.
 */
export default function EmployeeLifecycleCaseSummary({ employeeId }) {
  const { cases, isLoading } = useOpenCasesForEmployee(employeeId);

  if (isLoading) return null;

  if (!cases.length) {
    return (
      <div style={{ margin: "0.8rem" }}>
        <CardLayout style="generalCard cardPaddingSmall">
          <p className="textLight textXXS">No open lifecycle case.</p>
        </CardLayout>
      </div>
    );
  }

  return (
    <div style={{ margin: "0.8rem" }}>
      {cases.map((lifecycleCase) => {
        const progressValue =
          lifecycleCase.total_item_count > 0
            ? Math.round(
                (100 * lifecycleCase.completed_item_count) /
                  lifecycleCase.total_item_count,
              )
            : null;
        const basePath =
          lifecycleCase.case_type === "OFFBOARDING"
            ? "offboarding"
            : "onboarding";

        return (
          <CardLayout
            key={lifecycleCase.id}
            style="generalCard cardPaddingSmall"
          >
            <div className="employeeLifecycleCaseSummaryHeader">
              <p className="textBold textXS">
                {CASE_TYPE_LABEL[lifecycleCase.case_type]}
              </p>
              <StatusBadge
                status={
                  CASE_STATUSES.find((s) => s.value === lifecycleCase.status)
                    ?.label || lifecycleCase.status
                }
                type={CASE_STATUS_TYPE[lifecycleCase.status] || "grey"}
              />
            </div>

            <ProgressBar value={progressValue} label="Checklist progress" />

            <RouterButton
              to={`/app/hr/${basePath}/${lifecycleCase.id}`}
              name="View Full Case"
              style="button buttonType5 textXXS"
            />
          </CardLayout>
        );
      })}
    </div>
  );
}
