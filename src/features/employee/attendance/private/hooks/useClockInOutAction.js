// features/employee/attendance/private/hooks/useClockInOutAction.js

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useEmployee } from "@/context/EmployeeContext";
import { useMessage } from "@/context/MessageContext";
import { useAttendance } from "@/context/AttendanceProvider";
import useAttendanceTypes from "@/hooks/useAttendanceTypes";
import useAttendanceActivityMutations from "@/features/hr/attendance/private/hooks/useAttendanceActivityMutations";
import { attendanceActivityConfig } from "@/data/attendanceActivityConfig";

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

    await clockInAttendanceActivity({ ...data, employee_id: employee.id });

    setSidebarOpen(false);
    await refetchCurrent();
    queryClient.invalidateQueries({ queryKey: ["my_attendance_this_week"] });
    queryClient.invalidateQueries({ queryKey: ["my_current_status"] });
  }

  async function handleClockOut() {
    if (!currentActivity?.id) return;

    await clockOutAttendanceActivity(currentActivity.id);
    await refetchCurrent();
    queryClient.invalidateQueries({ queryKey: ["my_attendance_this_week"] });
    queryClient.invalidateQueries({ queryKey: ["my_current_status"] });
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
