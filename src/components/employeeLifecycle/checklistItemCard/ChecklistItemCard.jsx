import { CheckCircleIcon } from "@phosphor-icons/react";
import Button from "../../buttons/button/Button";
import StatusBadge from "../../status/statusBadge/StatusBadge";
import StatusBox from "../../status/statusBox/StatusBox";
import {
  ITEM_STATUSES,
  ITEM_STATUS_TYPE,
  ITEM_STATUS_ACTIONS,
} from "../../../features/employeeLifecycle/private/lifecycleItemStatusMeta";
import "./ChecklistItemCard.scss";

/**
 * One checklist item row -- every viewer who can open the case sees every
 * item ("visible but inert" for a department that doesn't own it), the
 * same ProjectTasksTab.jsx non-assignee pattern. `canAct` (computed by
 * canActOnItem in lifecycleCaseHelpers.js, factoring in item ownership,
 * DERIVED-vs-MANUAL class, and superadmin bypass) is the only thing that
 * gates whether the Mark Done/Undo button renders at all -- a SKIPPED item
 * never gets one, regardless of canAct, since there's no forward
 * transition out of it.
 */
export default function ChecklistItemCard({ item, itemMeta, canAct, onRequestStatusChange }) {
  const statusLabel = ITEM_STATUSES.find((s) => s.value === item.status)?.label || item.status;
  const actions = canAct ? ITEM_STATUS_ACTIONS[item.status] || [] : [];

  return (
    <div className="generalCard checklistItemCard cardPaddingSmall">
      <div className="checklistItemCardMainRow">
        <div className="checklistItemCardTitleGroup">
          <div className="checklistItemCardTitleRow">
            <CheckCircleIcon
              size={16}
              weight={item.status === "DONE" ? "fill" : "regular"}
              style={{ flexShrink: 0 }}
            />
            <p className={`textBold textXS ${item.status === "SKIPPED" ? "checklistItemSkipped" : ""}`}>
              {itemMeta?.label || item.item_key}
            </p>
          </div>

          {item.notes && <p className="textLight textXXS checklistItemCardNotes">{item.notes}</p>}
        </div>

        <div className="checklistItemCardStatusGroup">
          {itemMeta?.owner && <StatusBox status={itemMeta.owner} type="blue" />}
          <StatusBadge status={statusLabel} type={ITEM_STATUS_TYPE[item.status] || "grey"} />

          {actions.length > 0 && (
            <div className="checklistItemCardActions">
              {actions.map((action) => (
                <Button
                  key={action.label}
                  name={action.label}
                  style={`button buttonType5 ${action.style} textXXS`}
                  icon={action.icon}
                  size={14}
                  weight="bold"
                  onClick={() => onRequestStatusChange?.(item, action.nextStatus, action.label)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
