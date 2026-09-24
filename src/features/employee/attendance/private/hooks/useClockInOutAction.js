// features/employee/attendance/private/hooks/useClockInOutAction.js

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useEmployee } from "@/context/EmployeeContext";
import { useMessage } from "@/context/MessageContext";
import { useAttendance } from "@/context/AttendanceProvider";
import useAttendanceTypes from "@/hooks/useAttendanceTypes";
import useAttendanceActivityMutations from "@/features/hr/attendance/private/hooks/useAttendanceActivityMutations";
import { attendanceActivityConfig } from "@/data/attendanceActivityConfig";
import { applyAttendancePhotoUpload } from "@/services/storage/applyAttendancePhotoUpload";

/**
 * Shared clock-in/out wiring for ClockinMini (nav) and TodayAttendanceCard
 * (dashboard) -- both render their own Button/DataSidebar JSX (the layouts
 * differ), but share the exact same state/handlers/invalidation so a
 * clock-in/out from either surface updates both immediately, instead of
 * each maintaining its own copy of this logic.
 */
export default function useClockInOutAction() {
  const { employee } = useEmployee();
  const { showMessage } = useMessage();
  const { currentActivity, refetchCurrent } = useAttendance();
  const { attendanceTypes, loading: attendanceTypesLoading } =
    useAttendanceTypes();
  const { clockInAttendanceActivity, clockOutAttendanceActivity, saving } =
    useAttendanceActivityMutations();
  const queryClient = useQueryClient();

  const [sidebarOpen, setSidebarOpen] = useState(false);

  // DOUBLE-SUBMIT GUARD, shared by both surfaces that use this hook.
  //
  // `saving` alone cannot do this job here. DataForm disables its submit
  // button from the `saving` prop, but DataForm calls onSave WITHOUT awaiting
  // it (DataForm.jsx:113), and `saving` is React state that has not committed
  // by the time a fast second click lands. A ref flips synchronously within
  // the same click, which is the only thing that closes the window.
  //
  // This is the same bug already fixed on the HR side, where it was confirmed
  // in production -- one Add Activity submit produced two identical rows. The
  // employee-facing surfaces never got the fix, and they are the ones about to
  // be used by everyone at 08:30 simultaneously.
  const submittingRef = useRef(false);

  const columns = attendanceActivityConfig({ attendanceTypes });

  function openClockIn() {
    setSidebarOpen(true);
  }

  function closeClockIn() {
    setSidebarOpen(false);
  }

  async function handleClockIn(data) {
    if (!employee?.id) {
      showMessage("Employee not found", "error");
      return;
    }
    if (submittingRef.current) return;
    submittingRef.current = true;

    // try/catch is required, not defensive: clockInAttendanceActivity rethrows
    // (correctly), and DataForm does not await onSave -- so without this the
    // rejection is unhandled. The mutation's own toast fires, but the sidebar
    // stays open with no other signal and the guard below never releases.
    try {
      // MUST run before the insert. The live clock-in form gained a photo
      // field on 2026-09-24, and ImageUploadEditor stages a raw `File` --
      // which normalizeFields does not recognise, so PostgREST would
      // serialize it to the string "{}" and destroy the column. That exact
      // bug already happened once on the HR timeline edit form; enabling the
      // field here without this would reproduce it on every employee.
      const payload = await applyAttendancePhotoUpload(
        { ...data, employee_id: employee.id },
        employee.id,
      );

      await clockInAttendanceActivity(payload);

      setSidebarOpen(false);
      await refetchCurrent();
      queryClient.invalidateQueries({ queryKey: ["my_attendance_this_week"] });
      queryClient.invalidateQueries({ queryKey: ["my_current_status"] });
    } catch (err) {
      // The mutation already showed the message. Deliberately leave the
      // sidebar OPEN so the employee can correct and retry rather than losing
      // what they entered.
      //
      // Expect to land here when the new one-open-session index rejects a
      // duplicate (23505) -- that is the guard working, not a fault. Refetch
      // so the widget resyncs to the session that already exists.
      console.error("Clock in failed:", err);
      await refetchCurrent();
    } finally {
      submittingRef.current = false;
    }
  }

  async function handleClockOut() {
    if (!currentActivity?.id) return;
    if (submittingRef.current) return;
    submittingRef.current = true;

    try {
      await clockOutAttendanceActivity(currentActivity.id);
      await refetchCurrent();
      queryClient.invalidateQueries({ queryKey: ["my_attendance_this_week"] });
      queryClient.invalidateQueries({ queryKey: ["my_current_status"] });
    } catch (err) {
      // A swallowed clock-out failure used to leave the session open while the
      // UI carried on as though it had closed -- and an open session is
      // exactly what blocks the next clock-in. Refetch so the button reflects
      // the truth.
      console.error("Clock out failed:", err);
      await refetchCurrent();
    } finally {
      submittingRef.current = false;
    }
  }

  return {
    currentActivity,
    attendanceTypes,
    attendanceTypesLoading,
    columns,
    saving,
    sidebarOpen,
    openClockIn,
    closeClockIn,
    handleClockIn,
    handleClockOut,
  };
}
