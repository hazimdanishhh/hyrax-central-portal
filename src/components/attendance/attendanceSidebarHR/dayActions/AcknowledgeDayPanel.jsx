import { useState } from "react";
import {
  CheckIcon,
  XIcon,
  ArrowCounterClockwiseIcon,
} from "@phosphor-icons/react";
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
 * stands.
 *
 * ONE CATEGORY USES THIS: `insufficient_half_day` -- a half-day leave whose
 * worked half came up short of the expected hours. It is the only flag with no
 * upstream fix available: the leave fraction and the hours are both already
 * correct, the day just looks short, so there is nothing to record in HR2000
 * and acknowledging IS the resolution.
 *
 * Every other flag closes by CORRECTING THE DATA, not by declaring it closed.
 * Absences resolve when the day reaches HR2000 (as NPL if genuinely unpaid) and
 * the next leave sync turns it into an `on_leave` day, or when the attendance
 * activity is added. Leave conflicts and leave fraction errors resolve on that
 * same sync. Acknowledging any of them would be a second, competing source of
 * truth for something already converging.
 *
 * `category` is still a prop, and acknowledge_attendance_day still takes one,
 * because the acknowledgement table is keyed on (employee, date, category) --
 * the grain get_payroll_reconciliation_rows() emits. Absence acknowledgement
 * was removed on 2026-09-23; see acknowledge_attendance_day_rpc.sql, which
 * rejects 'absent' outright and is the authoritative gate.
 *
 * ACKNOWLEDGING CLOSES THE REVIEW, NOT THE FACT. The hours stay as recorded
 * and the period totals are unchanged; what clears is the flag.
 */
export default function AcknowledgeDayPanel({
  employeeId,
  workDateIso,
  category, // "insufficient_half_day"
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
  const selectedReason = reasons.find((r) => String(r.id) === String(reasonId));

  const label = "Short half-day hours";

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
        name="Acknowledge Short Hours"
        style="button buttonType4 rejection textBold textXXS"
        onClick={() => setOpen(true)}
      />
    );
  }

  const canSave = reasonId && (!selectedReason?.requires_notes || notes.trim());

  return (
    <div className="generalCard cardPaddingSmall cardGapSmall dayActionForm">
      <p className="textBold textXS">Acknowledge {label}</p>
      <p className="textLight textXXS">
        This accepts the recorded hours for the working half of the day as
        correct. Nothing about the hours or the leave changes — what it clears
        is the reconciliation flag.
      </p>

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
          style="button buttonType2 rejection textBold textXXS"
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
