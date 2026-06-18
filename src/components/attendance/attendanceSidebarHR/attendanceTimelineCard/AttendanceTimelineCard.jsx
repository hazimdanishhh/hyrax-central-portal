import { CheckIcon, ClockUserIcon, XIcon } from "@phosphor-icons/react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAttendanceActivitiesMetadata } from "../../../../features/hr/attendance/private/hooks/useAttendanceActivitiesMetadata";
import useAttendanceActivityMutations from "../../../../features/hr/attendance/private/hooks/useAttendanceActivityMutations";
import { attendanceActivitiesChangeClockInTimeConfig } from "../../../../pages/user/hr/attendanceManagement/list/changeClockInTimeConfig";
import { attendanceActivitiesChangeClockOutTimeConfig } from "../../../../pages/user/hr/attendanceManagement/list/changeClockOutTimeConfig";
import { getAttendanceActivitiesFilterConfig } from "../../../../pages/user/hr/attendanceManagement/list/filterConfig";
import Button from "../../../buttons/button/Button";
import StackedBarRenderer from "../../../chartCard/StackedBarRenderer";
import DataForm from "../../../crud/dataForm/DataForm";
import StatusBadge from "../../../status/statusBadge/StatusBadge";
import StatusBox from "../../../status/statusBox/StatusBox";
import AttendanceType from "../../attendanceType/AttendanceType";
import { attendanceActivityTableConfig } from "./tableConfig";
import AttendanceClock from "../../attendanceClock/AttendanceClock";

// Utility for formatting time natively
const formatTime = (timeString) => {
  if (!timeString) return "--:--";
  return new Date(timeString).toLocaleTimeString("en-MY", {
    timeStyle: "short",
  });
};

export default function AttendanceTimelineCard({
  activity,
  setModalType,
  setModalOpen,
  clockOutAttendanceActivity,
}) {
  const queryClient = useQueryClient();
  const [rowId, setRowId] = useState(null);
  const [isEditing, setIsEditing] = useState("none"); // "none" | "edit" | "clockIn" | "clockOut"

  // ==============
  // METADATA
  // ==============
  const {
    employees,
    departments,
    attendanceTypes,
    isLoading: metadataLoading,
  } = useAttendanceActivitiesMetadata();

  // ==============
  // MUTATIONS HOOK
  // ==============
  const {
    createAttendanceActivity: createRow,
    updateAttendanceActivity: updateRow,
    deleteAttendanceActivity: deleteRow,
    saving,
    deleting,
  } = useAttendanceActivityMutations();

  const columns = attendanceActivityTableConfig({
    employees,
    attendanceTypes,
  });

  //   CLOCK IN / OUT COLUMNS
  const clockInColumns = attendanceActivitiesChangeClockInTimeConfig();
  const clockOutColumns = attendanceActivitiesChangeClockOutTimeConfig();

  const filterConfig = getAttendanceActivitiesFilterConfig({
    employees,
    departments,
    attendanceTypes,
  });

  // ==============
  // SAVE + UPDATE
  // ==============
  async function handleRequestSave(data) {
    await updateRow(data);

    await queryClient.invalidateQueries({
      queryKey: ["attendance_activities"],
    });

    setIsEditing("none");
  }

  // ==============
  // DELETE
  // ==============
  async function handleRequestDelete(data) {
    await deleteRow(data.activity_id);

    await queryClient.invalidateQueries({
      queryKey: ["attendance_activities"],
    });

    setIsEditing("none");
  }

  return (
    <div
      key={activity.activity_id}
      className="generalCard cardPaddingSmall cardGapSmall"
    >
      {/* ACTIVITY HEADER: Type & Status */}
      <div className="attendanceCardSidebarHeader">
        <AttendanceType attendanceType={activity.attendance_type} />
        <StatusBadge status={activity.approval_status} />
      </div>

      {/* TEST VISUAL BAR */}
      <StackedBarRenderer
        data={[
          {
            name: "Worked",
            value:
              activity.check_in_time && activity.check_out_time // CHANGED HERE
                ? Number(
                    (
                      (new Date(activity.check_out_time) - // CHANGED HERE
                        new Date(activity.check_in_time)) / // CHANGED HERE
                      1000 /
                      60 /
                      60
                    ).toFixed(2),
                  )
                : 0,
          },
          {
            name: "Remaining",
            value:
              activity.check_in_time && activity.check_out_time // CHANGED HERE
                ? Math.max(
                    0,
                    8 -
                      (new Date(activity.check_out_time) - // CHANGED HERE
                        new Date(activity.check_in_time)) / // CHANGED HERE
                        1000 /
                        60 /
                        60,
                  ).toFixed(2)
                : 8,
          },
        ]}
        colorMap={{
          Worked: "#22c55e",
          Remaining: "#a1a1a1",
        }}
        height={30}
        noLegend
      />

      {/* TIMING TABLE */}
      <div className="attendanceCardSidebarHeader">
        <div className="cardLayoutFlexFull cardGapLarge">
          {/* <p className="textBold textXXS mb-1">{activity.event_source} Data</p> */}

          <AttendanceClock time={activity.check_in_time_only} type="clockin" />
          <AttendanceClock
            time={activity.check_out_time_only}
            type="clockout"
          />
        </div>
      </div>

      {/* ACTIVITY AUDIT FLAG (Micro-level warning) */}
      {activity.activity_audit_flag.includes("Valid") ? (
        <StatusBox status={activity.activity_audit_flag} type="green" />
      ) : (
        <StatusBox status={activity.activity_audit_flag} type="red" />
      )}

      {/* ACTION BUTTONS SPECIFIC TO THIS ACTIVITY */}
      {activity.event_source === "App" && (
        <>
          <div className="attendanceCardApprovalContainer">
            {/* CLOCK OUT (If currently active) */}
            {!activity.check_out_time && (
              <Button
                style="button buttonType2Clockout textBold textXXS"
                icon={ClockUserIcon}
                name="Clock Out"
                onClick={async () => {
                  await clockOutAttendanceActivity(activity.activity_id);
                }}
              />
            )}

            {/* APPROVE / REJECT (If Pending) */}
            {activity.approval_status === "Pending" &&
              activity.check_out_time && (
                <>
                  <Button
                    onClick={() => {
                      setRowId(activity.activity_id); // Target THIS specific activity
                      setModalType("approve");
                      setModalOpen(true);
                    }}
                    icon={CheckIcon}
                    style="button buttonType4 approval"
                    name="Approve"
                  />
                  <Button
                    onClick={() => {
                      setRowId(activity.activity_id); // Target THIS specific activity
                      setModalType("reject");
                      setModalOpen(true);
                    }}
                    icon={XIcon}
                    style="button buttonType4 rejection"
                    name="Reject"
                  />
                </>
              )}
          </div>

          {isEditing === "none" && (
            <>
              <Button
                onClick={() => {
                  setIsEditing("edit");
                }}
                style="button buttonType4 textBold textXXS mt-2"
                name="Edit"
              />
              <div className="attendanceCardApprovalContainer">
                <Button
                  onClick={() => {
                    setIsEditing("clockIn");
                  }}
                  style="button buttonType4 textBold textXXS mt-2"
                  name="Edit Clock In"
                />
                <Button
                  onClick={() => {
                    setIsEditing("clockOut");
                  }}
                  style="button buttonType4 textBold textXXS mt-2"
                  name="Edit Clock Out"
                />
              </div>
            </>
          )}
        </>
      )}

      {isEditing !== "none" && activity.event_source === "App" && (
        <DataForm
          columns={
            isEditing === "clockIn"
              ? clockInColumns
              : isEditing === "clockOut"
                ? clockOutColumns
                : columns
          }
          rowData={activity}
          onSave={handleRequestSave}
          onDelete={handleRequestDelete}
          onCancel={() => setIsEditing("none")}
          saving={saving}
          deleting={deleting}
          inlineForm
        />
      )}
    </div>
  );
}
