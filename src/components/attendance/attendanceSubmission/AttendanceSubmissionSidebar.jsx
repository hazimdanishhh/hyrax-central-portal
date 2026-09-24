import { AnimatePresence } from "framer-motion";
import { CalendarPlusIcon } from "@phosphor-icons/react";
import DataSidebar from "../../dataSidebar/DataSidebar";
import AttendanceSubmissionForm from "./AttendanceSubmissionForm";

/**
 * Sidebar shell for AttendanceSubmissionForm.
 *
 * TAKES THE SAME PROPS AS AttendanceBackfillWizard ON PURPOSE -- open,
 * onClose, scope, employeeOptions, currentEmployeeId, attendanceTypes -- so
 * putting this in front of a page, or taking it back out, is a one-line change
 * of the component name at the mount point. Nothing else on those pages moves.
 *
 * That matters because the wizard is still live and still correct for what it
 * was built for: HR reconciling many employees across many dates in bulk. This
 * replaces the single-employee case only, and the two can be compared side by
 * side before anything is removed.
 *
 * `attendanceTypes` is accepted and ignored -- the form loads its own through
 * useAttendanceActivitiesMetadata, which also gives it work_locations (needed
 * to derive a full day's end time per employee) and adjustment reasons. Kept
 * in the signature purely so the swap stays a one-word edit.
 */
export default function AttendanceSubmissionSidebar({
  open,
  onClose,
  scope = "hr",
  employeeOptions,
  currentEmployeeId,
  // eslint-disable-next-line no-unused-vars
  attendanceTypes,
}) {
  // "self" is the only scope where the employee is fixed. A manager picks from
  // their direct reports and HR from everyone, so both keep the picker -- and
  // in both cases the RPC re-derives the caller's rights per row regardless,
  // so this narrows the list without granting anything.
  const lockedEmployeeId = scope === "self" ? currentEmployeeId : undefined;

  return (
    <AnimatePresence>
      {open && (
        <DataSidebar
          title="Add Activities"
          icon={CalendarPlusIcon}
          open={open}
          onClose={onClose}
          isEditing={false}
          fullPage
        >
          <AttendanceSubmissionForm
            employeeId={lockedEmployeeId}
            employeeOptions={employeeOptions}
            onCancel={onClose}
            onSaved={onClose}
          />
        </DataSidebar>
      )}
    </AnimatePresence>
  );
}
