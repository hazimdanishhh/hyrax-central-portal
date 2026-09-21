import { useState } from "react";
import { CheckIcon, XIcon, ArrowCounterClockwiseIcon } from "@phosphor-icons/react";
import Button from "../../../buttons/button/Button";
import StatusBox from "../../../status/statusBox/StatusBox";
import SelectEditor from "../../../dataTable/editors/SelectEditor";
import TextareaEditor from "../../../dataTable/editors/TextareaEditor";
import { formatDate } from "@/functions/formatDate";
import useAttendanceAcknowledgementMutations, {
  useAcknowledgementReasons,
  useDayAcknowledgements,
} from "@/features/hr/attendance/private/hooks/useAttendanceAcknowledgement";
import "./DayActions.scss";

/**
 * Resolving a reconciliation flag on a day that is genuinely correct as it
 * stands -- overwhelmingly, confirming a real absence.
 *
 * WHY THIS EXISTS: payroll_reconciliation_glossary already instructs the
 * employee to "confirm it is a genuine unexcused absence before payroll treats
 * the day as unpaid", and there was no way to do it. The only way to clear an
 * Absent flag was to add attendance -- i.e. to record work that never happened
 * -- so a real absence stayed flagged forever and re-nagged every week.
 *
 * ACKNOWLEDGING AN ABSENCE DECLARES THE DAY UNPAID. That is its whole meaning.
 * It does NOT remove the day from daysAbsentCount: the employee was absent and
 * payroll still deducts the day. What it closes is the review.
 *
 * Only two categories are acknowledgeable. Leave conflicts and leave data
 * errors are deliberately excluded -- both resolve themselves once the
 * corrected leave arrives in the next HR2000 sync, so acknowledging them would
 * create a second, competing source of truth.
 */
export default function AcknowledgeDayPanel({
  employeeId,
  workDateIso,
  category, // "absent" | "insufficient_half_day"
  canAcknowledge,
  canRevoke,
}) {
  const [open, setOpen] = useState(false);
  const [reasonId, setReasonId] = useState("");
  const [notes, setNotes] = useState("");

  const { reasons } = useAcknowledgementReasons(category);
  const { acknowledgements } = useDayAcknowledgements({
    employeeId,
    workDate: workDateIso,
  });
  const { acknowledgeDay, acknowledging, revokeAcknowledgement, revoking } =
    useAttendanceAcknowledgementMutations();

  const existing = acknowledgements.find((a) => a.category === category);
  const selectedReason = reasons.find(
    (r) => String(r.id) === String(reasonId),
  );

  const label =
    category === "absent" ? "Absence" : "Short half-day hours";

  // Already resolved -- show who closed it and why, rather than the button.
  if (existing) {
    return (
      <div className="dayActionAcknowledged">
        <div className="dayActionRow">
          <StatusBox status={`${label} acknowledged`} type="grey" />
          {canRevoke && (
            <Button
              name="Revoke"
              icon={ArrowCounterClockwiseIcon}
              style="button buttonType4 textBold textXXS"
              onClick={() =>
                revokeAcknowledgement({
                  employeeId,
                  workDate: workDateIso,
                  category,
                })
              }
              disabled={revoking}
            />
          )}
        </div>
        <p className="textLight textXXS">
          {existing.reason?.label}
          {existing.acknowledged_by_employee?.full_name
            ? ` — by ${existing.acknowledged_by_employee.full_name}`
            : ""}
          {existing.acknowledged_at
            ? ` on ${formatDate(existing.acknowledged_at)}`
            : ""}
        </p>
        {existing.notes && (
          <p className="textRegular textXXS">{existing.notes}</p>
        )}
      </div>
    );
  }

  if (!canAcknowledge) return null;

  if (!open) {
    return (
      <Button
        name={
          category === "absent"
            ? "Acknowledge Absence"
            : "Acknowledge Short Hours"
        }
        style="button buttonType4 textBold textXXS"
        onClick={() => setOpen(true)}
      />
    );
  }

  const canSave =
    reasonId && (!selectedReason?.requires_notes || notes.trim());

  return (
    <div className="generalCard cardPaddingSmall cardGapSmall dayActionForm">
      <p className="textBold textXS">Acknowledge {label}</p>
      {category === "absent" && (
        <p className="textLight textXXS">
          This records the day as a genuine absence and treats it as unpaid. It
          stays counted as an absence for payroll — what it clears is the
          reconciliation flag.
        </p>
      )}

      <SelectEditor
        value={reasonId}
        onChange={setReasonId}
        options={reasons.map((r) => ({ label: r.label, value: r.id }))}
        placeholder="Reason"
      />
      {selectedReason && (
        <p className="textLight textXXS">{selectedReason.description}</p>
      )}

      <TextareaEditor value={notes} onChange={setNotes} />

      <div className="dayActionButtons">
        <Button
          name="Cancel"
          icon={XIcon}
          style="button buttonType4 textBold textXXS"
          onClick={() => setOpen(false)}
        />
        <Button
          name="Acknowledge"
          icon={CheckIcon}
          style="button buttonType2 textBold textXXS"
          disabled={!canSave || acknowledging}
          onClick={async () => {
            await acknowledgeDay({
              employeeId,
              workDate: workDateIso,
              category,
              reasonId,
              notes,
            });
            setOpen(false);
            setReasonId("");
            setNotes("");
          }}
        />
      </div>
    </div>
  );
}
