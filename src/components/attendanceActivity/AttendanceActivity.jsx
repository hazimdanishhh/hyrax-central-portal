import { ClockUserIcon, SignOutIcon } from "@phosphor-icons/react";
import useAttendanceActivities from "../../hooks/useAttendanceActivities";
import CardLayout from "../cardLayout/CardLayout";

function AttendanceActivity() {
  const { attendanceActivities, loading: attendanceActivitiesLoading } =
    useAttendanceActivities();

  return (
    <>
      {attendanceActivities.map((attendanceActivity) => (
        <CardLayout key={attendanceActivity.id} style="cardLayout2 generalCard">
          <CardLayout style="cardLayout1">
            <p>
              {attendanceActivity.attendance_type?.name} <ClockUserIcon />
            </p>
            <p>{attendanceActivity.clocked_in_at}</p>
          </CardLayout>

          <CardLayout style="cardLayout1">
            <p>
              Clock Out <SignOutIcon />
            </p>
            <p>{attendanceActivity.clocked_out_at}</p>
          </CardLayout>
        </CardLayout>
      ))}
    </>
  );
}

export default AttendanceActivity;
