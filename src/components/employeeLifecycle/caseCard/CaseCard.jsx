import { ClockIcon } from "@phosphor-icons/react";
import EmployeeImage from "../../employees/employeeImage/EmployeeImage";
import StatusBadge from "../../status/statusBadge/StatusBadge";
import StatusBox from "../../status/statusBox/StatusBox";
import IconCard from "../../iconCard/IconCard";
import ProgressBar from "../../progressBar/ProgressBar";
import {
  CASE_STATUSES,
  CASE_STATUS_TYPE,
} from "../../../features/employeeLifecycle/private/lifecycleCaseStatusMeta";
import { getWaitingOnOwner } from "../../../features/employeeLifecycle/private/lifecycleCaseHelpers";
import { formatDate } from "../../../functions/formatDate";
import "./CaseCard.scss";

/**
 * List-view card for one lifecycle case -- modeled on TaskCard.jsx, but
 * with no inline quick-action buttons: a case's next action always
 * requires opening the detail page to see which specific item is next, so
 * the whole card is a single click target straight into LifecycleCaseDetail
 * rather than exposing a status-transition button here.
 */
export default function CaseCard({ lifecycleCase, onClick }) {
  const statusLabel =
    CASE_STATUSES.find((s) => s.value === lifecycleCase.status)?.label ||
    lifecycleCase.status;
  const waitingOn =
    lifecycleCase.status === "OPEN"
      ? getWaitingOnOwner(lifecycleCase.items ?? [], lifecycleCase.case_type)
      : null;
  const progressValue =
    lifecycleCase.total_item_count > 0
      ? Math.round(
          (100 * lifecycleCase.completed_item_count) /
            lifecycleCase.total_item_count,
        )
      : null;

  return (
    <div className="generalCard caseCard cardPaddingSmall" onClick={onClick}>
      <div className="caseCardMainRow">
        <div className="caseCardEmployeeGroup">
          <EmployeeImage
            employee={lifecycleCase.employee}
            employeeId={lifecycleCase.employee_id}
            displayName
            showName={false}
            setShowName={() => {}}
          />
        </div>

        <div className="caseCardStatusWrapper">
          <div className="caseCardStatusGroup">
            <StatusBadge
              status={statusLabel}
              type={CASE_STATUS_TYPE[lifecycleCase.status] || "grey"}
            />

            {waitingOn && (
              <StatusBox status={`Waiting on: ${waitingOn}`} type="yellow" />
            )}

            <IconCard
              icon={ClockIcon}
              weight="fill"
              name={`Opened: ${formatDate(lifecycleCase.opened_at)}`}
              style="blue textXXS"
            />
          </div>

          <ProgressBar
            value={progressValue}
            label={`${lifecycleCase.employee?.full_name || "Case"} progress`}
          />
        </div>
      </div>
    </div>
  );
}
