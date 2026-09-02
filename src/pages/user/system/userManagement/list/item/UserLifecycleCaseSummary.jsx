import CardLayout from "../../../../../../components/cardLayout/CardLayout";
import StatusBadge from "../../../../../../components/status/statusBadge/StatusBadge";
import ProgressBar from "../../../../../../components/progressBar/ProgressBar";
import Button from "../../../../../../components/buttons/button/Button";
import RouterButton from "../../../../../../components/buttons/routerButton/RouterButton";
import { UserMinusIcon } from "@phosphor-icons/react";
import { useOpenCasesForEmployee } from "../../../../../../features/employeeLifecycle/private/hooks/useOpenCasesForEmployee";
import { useLifecycleCaseMutations } from "../../../../../../features/employeeLifecycle/private/hooks/useLifecycleCaseMutations";
import {
  CASE_STATUSES,
  CASE_STATUS_TYPE,
  CASE_TYPE_LABEL,
} from "../../../../../../features/employeeLifecycle/private/lifecycleCaseStatusMeta";

/**
 * Superadmin Users page's lifecycle-case awareness -- confirmed missing
 * entirely (see docs/EMPLOYEE-LIFECYCLE-CHECKLIST-ARCHITECTURE.md Part 1
 * audit). Mirrors EmployeeLifecycleCaseSummary.jsx's shape (Employee
 * Management's own sidebar slot), plus a second "Deactivate Portal
 * Account" path -- superadmin-only here (unlike LifecycleCaseDetail.jsx's
 * button, which is also open to IT), since this page itself is a
 * superadmin tool.
 */
export default function UserLifecycleCaseSummary({ profileId, employeeId }) {
  const { cases, isLoading } = useOpenCasesForEmployee(employeeId);
  const { deactivateProfile, deactivatingProfile } = useLifecycleCaseMutations(
    null,
    employeeId,
    null,
  );

  if (!employeeId || isLoading) return null;

  const openOffboardingCase = cases.find((c) => c.case_type === "OFFBOARDING");

  async function handleDeactivate() {
    await deactivateProfile(profileId);
  }

  return (
    <CardLayout style="cardPadding cardGapSmall">
      <p className="textBold textXS">Lifecycle Cases</p>

      {!cases.length ? (
        <p className="textLight textXXS">No open lifecycle case.</p>
      ) : (
        cases.map((lifecycleCase) => {
          const progressValue =
            lifecycleCase.total_item_count > 0
              ? Math.round(
                  (100 * lifecycleCase.completed_item_count) / lifecycleCase.total_item_count,
                )
              : null;
          const basePath = lifecycleCase.case_type === "OFFBOARDING" ? "offboarding" : "onboarding";

          return (
            <div key={lifecycleCase.id} className="cardLayoutFlex cardGapSmall">
              <div className="employeeLifecycleCaseSummaryHeader">
                <p className="textBold textXS">{CASE_TYPE_LABEL[lifecycleCase.case_type]}</p>
                <StatusBadge
                  status={
                    CASE_STATUSES.find((s) => s.value === lifecycleCase.status)?.label
                    || lifecycleCase.status
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
            </div>
          );
        })
      )}

      {openOffboardingCase && (
        <Button
          name="Deactivate Portal Account"
          icon={UserMinusIcon}
          style="button buttonType4 rejection textXXS"
          size={14}
          disabled={deactivatingProfile}
          onClick={handleDeactivate}
        />
      )}
    </CardLayout>
  );
}
