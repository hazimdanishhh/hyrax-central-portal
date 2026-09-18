// pages/user/sales/orders/budgets/SalesBudgetDetail.jsx
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
import { useAllSalesBudgets } from "../../../../../features/sales/salesBudgets/private/hooks/useAllSalesBudgets";
import { useSalesBudgetsMetadata } from "../../../../../features/sales/salesBudgets/private/hooks/useSalesBudgetsMetadata";
import useSalesBudgetsMutations from "../../../../../features/sales/salesBudgets/private/hooks/useSalesBudgetsMutations";
import {
  MONTH_LABELS,
  buildMonthDate,
} from "../../../../../features/_shared/monthGrid";
import "../../leads/targets/SalesTargetDetail.scss";

/**
 * Sidebar content for one (sales_rep_code, year) group -- mirrors
 * SalesTargetDetail.jsx exactly, keyed by the SAP-side rep identity
 * (bigint) instead of the CRM-side lead_owner_id (uuid). Rendered as a
 * DataSidebar's children by SalesBudgetsManagement.jsx.
 */
export default function SalesBudgetDetail({ repCode, year }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const repCodeNum = Number(repCode);
  const yearNum = Number(year);

  const { budgets, isLoading } = useAllSalesBudgets();
  const { salesReps } = useSalesBudgetsMetadata();
  const repName = salesReps.find(
    (r) => r.sales_rep_code === repCodeNum,
  )?.sales_rep_name;

  // Years this rep actually has data for, plus the currently-open year
  // itself (so a brand-new, still-empty year picked via "Add Budget"
  // doesn't break prev/next -- it just has no neighbors yet).
  const repYears = useMemo(() => {
    const years = new Set(
      budgets
        .filter((b) => b.sales_rep_code === repCodeNum)
        .map((b) => new Date(b.budget_month).getUTCFullYear()),
    );
    years.add(yearNum);
    return Array.from(years).sort((a, b) => a - b);
  }, [budgets, repCodeNum, yearNum]);

  const yearIndex = repYears.indexOf(yearNum);
  const prevYear = yearIndex > 0 ? repYears[yearIndex - 1] : null;
  const nextYear = yearIndex < repYears.length - 1 ? repYears[yearIndex + 1] : null;

  function goToYear(targetYear) {
    navigate(`/app/sales/orders/budgets/${repCode}/${targetYear}?${searchParams.toString()}`);
  }

  const {
    createSalesBudget,
    updateSalesBudget,
    deleteSalesBudget,
    creating,
    updating,
    deleting,
  } = useSalesBudgetsMutations();
  const { modalOpen, selectedRowId, handleRequestDelete, closeActionModal } =
    useCrudActionState();

  const monthRows = useMemo(() => {
    return MONTH_LABELS.map((label, monthIndex) => {
      const existing = budgets.find((b) => {
        if (b.sales_rep_code !== repCodeNum) return false;
        const d = new Date(b.budget_month);
        return d.getUTCFullYear() === yearNum && d.getUTCMonth() === monthIndex;
      });
      return { monthIndex, label, existing };
    });
  }, [budgets, repCodeNum, yearNum]);

  const [editingMonth, setEditingMonth] = useState(null);
  const [draftValue, setDraftValue] = useState("");

  const isSaving = creating || updating;

  function startEdit(row) {
    setEditingMonth(row.monthIndex);
    setDraftValue(row.existing?.budget_revenue ?? "");
  }

  function cancelEdit() {
    setEditingMonth(null);
    setDraftValue("");
  }

  async function saveMonth(row) {
    try {
      if (row.existing) {
        await updateSalesBudget({
          id: row.existing.id,
          budget_revenue: draftValue,
        });
      } else {
        await createSalesBudget({
          sales_rep_code: repCodeNum,
          budget_month: buildMonthDate(yearNum, row.monthIndex),
          budget_revenue: draftValue,
        });
      }
      cancelEdit();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleConfirmDelete() {
    try {
      await deleteSalesBudget(selectedRowId);
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
    (sum, row) => sum + Number(row.existing?.budget_revenue || 0),
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
            {repName || "..."} · {yearNum}
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
          Set each month's revenue budget independently
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
                    ? `RM ${Math.round(row.existing.budget_revenue).toLocaleString()}`
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
        title="Delete Budget"
        description="Are you sure you want to delete this month's budget?"
        confirmText="Delete"
        loading={deleting}
        onConfirm={handleConfirmDelete}
        modalType="delete"
      />
    </div>
  );
}
