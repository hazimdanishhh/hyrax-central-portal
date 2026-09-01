import { useState } from "react";
import { useParams } from "react-router";
import { AnimatePresence } from "framer-motion";
import {
  ListChecksIcon,
  PencilSimpleLineIcon,
  ClockIcon,
} from "@phosphor-icons/react";
import { useTheme } from "../../../../context/ThemeContext";
import { useAccessControl } from "../../../../context/AccessControlContext";
import { useProfile } from "../../../../context/ProfileContext";
import Breadcrumbs from "../../../../components/breadcrumbs/Breadcrumbs";
import CardWrapper from "../../../../components/cardWrapper/CardWrapper";
import CardLayout from "../../../../components/cardLayout/CardLayout";
import LoadingIcon from "../../../../components/loadingIcon/LoadingIcon";
import NoResult from "../../../../components/crud/noResult/NoResult";
import Button from "../../../../components/buttons/button/Button";
import StatusBadge from "../../../../components/status/statusBadge/StatusBadge";
import EmployeeImage from "../../../../components/employees/employeeImage/EmployeeImage";
import IconCard from "../../../../components/iconCard/IconCard";
import ProgressBar from "../../../../components/progressBar/ProgressBar";
import DataSidebar from "../../../../components/dataSidebar/DataSidebar";
import ActionModal from "../../../../components/modals/actionModal/ActionModal";
import ChecklistItemCard from "../../../../components/employeeLifecycle/checklistItemCard/ChecklistItemCard";
import { useLifecycleCaseById } from "../../../../features/employeeLifecycle/private/hooks/useLifecycleCaseById";
import { useLifecycleCaseMutations } from "../../../../features/employeeLifecycle/private/hooks/useLifecycleCaseMutations";
import { useChecklistItemStatusAction } from "../../../../features/employeeLifecycle/private/hooks/useChecklistItemStatusAction";
import {
  getItemMeta,
  canActOnItem,
  getProgressPercentage,
} from "../../../../features/employeeLifecycle/private/lifecycleCaseHelpers";
import {
  CASE_STATUSES,
  CASE_STATUS_TYPE,
} from "../../../../features/employeeLifecycle/private/lifecycleCaseStatusMeta";
import { ITEM_STATUSES } from "../../../../features/employeeLifecycle/private/lifecycleItemStatusMeta";
import { lifecycleCaseMetadataTableConfig } from "./caseMetadataTableConfig";
import { formatDate } from "../../../../functions/formatDate";
import "./LifecycleCaseDetail.scss";

/**
 * The one shared case-detail component -- mounted identically at
 * hr/onboarding/:caseId, hr/offboarding/:caseId, it/onboarding/:caseId,
 * it/offboarding/:caseId (see routes). Route-level <AccessRoute> already
 * decided which cases this viewer can reach at all; canActOnItem here
 * decides which items they can act on once they're in -- that split is the
 * entire mechanism behind "one unified case, filtered per viewer" (see
 * docs/EMPLOYEE-LIFECYCLE-CHECKLIST-ARCHITECTURE.md). No caseType prop is
 * needed -- the fetched case row already carries its own case_type, used
 * to pick the matching fixed checklist meta.
 *
 * A single flat page, not a tabbed shell like ProjectDetailLayout.jsx --
 * there's exactly one checklist and no sub-navigation for this feature.
 */
export default function LifecycleCaseDetail() {
  const { darkMode } = useTheme();
  const { caseId } = useParams();
  const { departmentSub, isSuperAdmin } = useAccessControl();
  const { profile } = useProfile();

  const { lifecycleCase, isLoading, error } = useLifecycleCaseById(caseId);
  const {
    updateLifecycleCase,
    updateChecklistItemStatus,
    updatingCase,
    updatingItem,
  } = useLifecycleCaseMutations(
    caseId,
    lifecycleCase?.employee_id,
    lifecycleCase?.case_type,
  );
  const {
    pendingAction,
    modalOpen,
    requestStatusChange,
    cancelAction,
    confirmAction,
  } = useChecklistItemStatusAction(updateChecklistItemStatus, profile?.id);

  const [editingOpen, setEditingOpen] = useState(false);

  if (isLoading) {
    return (
      <CardLayout style="cardLayoutFlexFull">
        <LoadingIcon />
      </CardLayout>
    );
  }

  // A null result with no error is the correct behavior once RLS is
  // enforced -- a viewer without HR/IT/superadmin standing on this case
  // simply gets zero rows back, no special-cased "unauthorized" branch.
  if (!lifecycleCase || error) {
    return <NoResult title="Case not found" />;
  }

  const sortedItems = [...lifecycleCase.items].sort(
    (a, b) =>
      (getItemMeta(lifecycleCase.case_type, a.item_key)?.sortOrder ?? 0) -
      (getItemMeta(lifecycleCase.case_type, b.item_key)?.sortOrder ?? 0),
  );
  const progressValue = getProgressPercentage(lifecycleCase.items);
  const title =
    lifecycleCase.case_type === "OFFBOARDING" ? "Offboarding" : "Onboarding";
  // ".." not "../onboarding" -- react-router resolves a relative Link
  // against the ROUTE PATTERN (hr/onboarding/:caseId), not the literal
  // URL, so ".." alone already lands on the parent "onboarding"/
  // "offboarding" route (the list page); appending the segment name again
  // double-appends it (onboarding/onboarding). Works identically whether
  // this component is mounted under hr/ or it/, since it's relative.
  const listPath = "..";

  const editColumns = lifecycleCaseMetadataTableConfig({
    caseType: lifecycleCase.case_type,
  });

  async function handleEditSave(formData) {
    await updateLifecycleCase({ id: lifecycleCase.id, ...formData });
    setEditingOpen(false);
  }

  const pendingLabel = pendingAction?.label;
  const pendingStatusName =
    ITEM_STATUSES.find((s) => s.value === pendingAction?.nextStatus)?.label ||
    "Updated";

  return (
    <section className={darkMode ? "sectionDark" : "sectionLight"}>
      <div className="sectionWrapper">
        <div className="sectionContent">
          <Breadcrumbs
            icon={ListChecksIcon}
            current={lifecycleCase.employee?.full_name || title}
            to1={listPath}
            name1={title}
            icon1={ListChecksIcon}
          />

          <CardWrapper>
            <div className="lifecycleCaseDetailHeader generalCard">
              <div className="lifecycleCaseDetailHeaderTop">
                <div className="lifecycleCaseDetailHeaderTitle">
                  <EmployeeImage
                    employee={lifecycleCase.employee}
                    employeeId={lifecycleCase.employee_id}
                    displayName
                  />
                  <StatusBadge
                    status={
                      CASE_STATUSES.find(
                        (s) => s.value === lifecycleCase.status,
                      )?.label || lifecycleCase.status
                    }
                    type={CASE_STATUS_TYPE[lifecycleCase.status] || "grey"}
                  />
                </div>

                <div className="lifecycleCaseDetailHeaderDates">
                  <IconCard
                    icon={ClockIcon}
                    weight="fill"
                    name={`Opened: ${formatDate(lifecycleCase.opened_at)}`}
                    style="blue textXXS"
                  />
                  {lifecycleCase.expected_last_day && (
                    <IconCard
                      icon={ClockIcon}
                      weight="fill"
                      name={`Expected Last Day: ${formatDate(lifecycleCase.expected_last_day)}`}
                      style="yellow textXXS"
                    />
                  )}
                </div>

                {(departmentSub === "HR" || isSuperAdmin) && (
                  <div className="lifecycleCaseDetailHeaderActions">
                    <Button
                      name="Edit"
                      icon={PencilSimpleLineIcon}
                      style="button buttonType5 textXS"
                      size={16}
                      onClick={() => setEditingOpen(true)}
                    />
                  </div>
                )}
              </div>

              <ProgressBar
                value={progressValue}
                label={`${lifecycleCase.employee?.full_name || "Case"} checklist progress`}
              />

              {lifecycleCase.status === "COMPLETED" &&
                lifecycleCase.case_type === "ONBOARDING" &&
                lifecycleCase.confirmationDueDate && (
                  <p className="textLight textXXS lifecycleCaseDetailProbationNote">
                    Probation review due:{" "}
                    {formatDate(lifecycleCase.confirmationDueDate)}
                  </p>
                )}
            </div>

            <CardLayout style="cardLayout1 cardGapSmall">
              {sortedItems.map((item) => {
                const itemMeta = getItemMeta(
                  lifecycleCase.case_type,
                  item.item_key,
                );
                return (
                  <ChecklistItemCard
                    key={item.id}
                    item={item}
                    itemMeta={itemMeta}
                    canAct={canActOnItem(item, itemMeta, {
                      departmentSub,
                      isSuperAdmin,
                    })}
                    onRequestStatusChange={requestStatusChange}
                  />
                );
              })}
            </CardLayout>
          </CardWrapper>
        </div>
      </div>

      <AnimatePresence>
        {editingOpen && (
          <DataSidebar
            title="Edit Case"
            icon={PencilSimpleLineIcon}
            open={editingOpen}
            onClose={() => setEditingOpen(false)}
            rowData={lifecycleCase}
            columns={editColumns}
            onSave={handleEditSave}
            onCancel={() => setEditingOpen(false)}
            saving={updatingCase}
            hideDelete
          />
        )}
      </AnimatePresence>

      <ActionModal
        open={modalOpen}
        onClose={cancelAction}
        title={`${pendingLabel || "Update"} Checklist Item`}
        description={`Are you sure you want to mark "${getItemMeta(lifecycleCase.case_type, pendingAction?.item?.item_key)?.label || ""}" as ${pendingStatusName}?`}
        confirmText={pendingLabel || "Confirm"}
        loading={updatingItem}
        onConfirm={confirmAction}
        modalType={pendingLabel === "Undo" ? "delete" : "approve"}
      />
    </section>
  );
}
