// pages/user/sales/leads/targets/SalesTargetDetail.jsx
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  PencilSimpleLineIcon,
  TrashSimpleIcon,
  CheckIcon,
  XIcon,
  CaretLeftIcon,
  CaretRightIcon,
} from "@phosphor-icons/react";
import CardLayout from "../../../../../components/cardLayout/CardLayout";
import LoadingIcon from "../../../../../components/loadingIcon/LoadingIcon";
import Button from "../../../../../components/buttons/button/Button";
import ActionModal from "../../../../../components/modals/actionModal/ActionModal";
import useCrudActionState from "../../../../../hooks/useCrudActionState";
import { useAllSalesTargets } from "../../../../../features/sales/salesTargets/private/hooks/useAllSalesTargets";
import { useEmployeeOption } from "../../../../../features/sales/salesTargets/private/hooks/useEmployeeOption";
import useSalesTargetsMutations from "../../../../../features/sales/salesTargets/private/hooks/useSalesTargetsMutations";
import {
  MONTH_LABELS,
  buildMonthDate,
} from "../../../../../features/_shared/monthGrid";
import "./SalesTargetDetail.scss";

/**
 * Sidebar content for one (lead_owner_id, year) group -- rendered as a
 * DataSidebar's children by SalesTargetsManagement.jsx (isEditing={false},
 * so no DataForm), URL-driven via :ownerId/:year same as any other
 * sidebar in this app. Exactly 12 fixed rows (Jan-Dec), only revenue ever
 * editable. Deliberately NOT DataTable/DataForm/the editor registry (see
 * SalesTargetsManagement.jsx's own header comment for why): that
 * machinery is for variable-length, arbitrary-row CRUD, while this is a
 * fixed grid where the date must be *constructed* (buildMonthDate), never
 * read from a form field -- the whole point of this existing is to make a
 * wrong day structurally impossible, not just silently corrected after
 * the fact.
 */
export default function SalesTargetDetail({ ownerId, year }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const yearNum = Number(year);

  const { targets, isLoading } = useAllSalesTargets();
  const { data: repOption } = useEmployeeOption(ownerId);

  // Years this rep actually has data for, plus the currently-open year
  // itself (so a brand-new, still-empty year picked via "Add Target"
  // doesn't break prev/next -- it just has no neighbors yet).
  const repYears = useMemo(() => {
    const years = new Set(
      targets
        .filter((t) => t.lead_owner_id === ownerId)
        .map((t) => new Date(t.target_month).getUTCFullYear()),
    );
    years.add(yearNum);
    return Array.from(years).sort((a, b) => a - b);
  }, [targets, ownerId, yearNum]);

  const yearIndex = repYears.indexOf(yearNum);
  const prevYear = yearIndex > 0 ? repYears[yearIndex - 1] : null;
  const nextYear = yearIndex < repYears.length - 1 ? repYears[yearIndex + 1] : null;

  function goToYear(targetYear) {
    navigate(`/app/sales/leads/targets/${ownerId}/${targetYear}?${searchParams.toString()}`);
  }
  const {
    createSalesTarget,
    updateSalesTarget,
    deleteSalesTarget,
    creating,
    updating,
    deleting,
  } = useSalesTargetsMutations();
  const { modalOpen, selectedRowId, handleRequestDelete, closeActionModal } =
    useCrudActionState();

  const monthRows = useMemo(() => {
    return MONTH_LABELS.map((label, monthIndex) => {
      const existing = targets.find((t) => {
        if (t.lead_owner_id !== ownerId) return false;
        const d = new Date(t.target_month);
        return d.getUTCFullYear() === yearNum && d.getUTCMonth() === monthIndex;
      });
      return { monthIndex, label, existing };
    });
  }, [targets, ownerId, yearNum]);

  const [editingMonth, setEditingMonth] = useState(null);
  const [draftValue, setDraftValue] = useState("");

  const isSaving = creating || updating;

  function startEdit(row) {
    setEditingMonth(row.monthIndex);
    setDraftValue(row.existing?.target_revenue ?? "");
  }

  function cancelEdit() {
    setEditingMonth(null);
    setDraftValue("");
  }

  async function saveMonth(row) {
    try {
      if (row.existing) {
        await updateSalesTarget({
          id: row.existing.id,
          target_revenue: draftValue,
        });
      } else {
        await createSalesTarget({
          lead_owner_id: ownerId,
          target_month: buildMonthDate(yearNum, row.monthIndex),
          target_revenue: draftValue,
        });
      }
      cancelEdit();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleConfirmDelete() {
    try {
      await deleteSalesTarget(selectedRowId);
      closeActionModal();
    } catch (err) {
      console.error(err);
    }
  }

  if (isLoading) {
    return (
      <CardLayout style="cardLayoutFlexFull">
        <LoadingIcon />
      </CardLayout>
    );
  }

  const totalRevenue = monthRows.reduce(
    (sum, row) => sum + Number(row.existing?.target_revenue || 0),
    0,
  );

  return (
    <div className="salesQuotaSidebarContainer">
      <div className="salesQuotaSidebarHeader">
        <div className="salesQuotaYearSwitcher">
          <Button
            icon={CaretLeftIcon}
            style="iconButton2"
            size={18}
            disabled={prevYear == null}
            onClick={() => goToYear(prevYear)}
          />
          <p className="textBold textM">
            {repOption?.label || "..."} · {yearNum}
          </p>
          <Button
            icon={CaretRightIcon}
            style="iconButton2"
            size={18}
            disabled={nextYear == null}
            onClick={() => goToYear(nextYear)}
          />
        </div>
        <p className="textLight textXXS">
          Set each month's pipeline target independently
        </p>
      </div>

      <CardLayout style="cardLayout1 cardGapSmall">
        {monthRows.map((row) => (
          <div
            key={row.monthIndex}
            className="generalCard cardPaddingSmall salesQuotaMonthRow"
          >
            <p className="textBold textXS">{row.label}</p>

            {editingMonth === row.monthIndex ? (
              <>
                <input
                  type="number"
                  min={0}
                  autoFocus
                  value={draftValue}
                  onChange={(e) => setDraftValue(e.target.value)}
                />
                <Button
                  icon={CheckIcon}
                  style="iconButton2 approval"
                  disabled={
                    draftValue === "" || Number(draftValue) < 0 || isSaving
                  }
                  onClick={() => saveMonth(row)}
                  size={18}
                />
                <Button
                  icon={XIcon}
                  style="iconButton2 rejection"
                  onClick={cancelEdit}
                  size={18}
                />
              </>
            ) : (
              <>
                <p className="textRegular textXS">
                  {row.existing
                    ? `RM ${Math.round(row.existing.target_revenue).toLocaleString()}`
                    : "—"}
                </p>
                <Button
                  icon={PencilSimpleLineIcon}
                  style="iconButton2"
                  onClick={() => startEdit(row)}
                  size={18}
                />
                <Button
                  icon={TrashSimpleIcon}
                  style="iconButton2 rejection"
                  disabled={!row.existing}
                  onClick={() => handleRequestDelete(row.existing)}
                  size={18}
                />
              </>
            )}
          </div>
        ))}
      </CardLayout>

      <div className="salesQuotaTotalRow">
        <p className="textBold textXS">Total</p>
        <p className="textBold textXS">
          {`RM ${Math.round(totalRevenue).toLocaleString()}`}
        </p>
      </div>

      <ActionModal
        open={modalOpen}
        onClose={closeActionModal}
        title="Delete Target"
        description="Are you sure you want to delete this month's target?"
        confirmText="Delete"
        loading={deleting}
        onConfirm={handleConfirmDelete}
        modalType="delete"
      />
    </div>
  );
}
