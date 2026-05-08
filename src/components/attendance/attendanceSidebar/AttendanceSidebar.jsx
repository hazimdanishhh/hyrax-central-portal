import React from "react";
import StatusBadge from "../../status/statusBadge/StatusBadge";
import AttendanceType from "../attendanceType/AttendanceType";
import {
  CheckIcon,
  ClockUserIcon,
  SignInIcon,
  SignOutIcon,
  XIcon,
} from "@phosphor-icons/react";
import Button from "../../buttons/button/Button";
import { Link } from "react-router";
import AttendanceClock from "../attendanceClock/AttendanceClock";

// SIDEBAR UI FOR MY ATTENDANCE PAGE
export default function AttendanceSidebar({
  selectedRow,
  setSelectedId,
  setModalType,
  setModalOpen,
  clockOutAttendanceActivity,
}) {
  return (
    <div className="attendanceCardSidebarContainer">
      {/* HEADER DATE & APPROVAL STATUS */}
      <div className="attendanceCardSidebarHeader">
        <p className="textBold texS">{selectedRow.clocked_in_date}</p>
        <StatusBadge status={selectedRow.approval_status} />
      </div>

      {/* EMPLOYEE AVATAR */}
      <div className="attendanceCardSidebarSegment">
        <div className="cardLayoutFlexFull cardGapMedium cardLayoutNoPadding">
          <div className="generalCardPhoto mobile">
            <img
              src={selectedRow.avatar_url || "/profilePhoto/default.webp"}
              alt={selectedRow.employee_name}
            />
          </div>

          {/* EMPLOYEE NAME & CLOCKED IN/OUT TIME */}
          <div className="attendanceCardSidebarDetailsContainer">
            <div className="attendanceCardSidebarDetails">
              <p className="textBold textS">{selectedRow.employee_name}</p>
              <AttendanceType
                attendanceType={selectedRow.attendance_type_name}
              />
            </div>

            <div className="attendanceCardSidebarDetails">
              <AttendanceClock
                time={selectedRow.clocked_in_time}
                type="clockin"
              />

              {selectedRow.clocked_out_at && (
                <AttendanceClock
                  time={selectedRow.clocked_out_time}
                  type="clockout"
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* CLOCK OUT BUTTON */}
      {!selectedRow.clocked_out_at && (
        <Button
          style="button buttonType2Clockout textBold textXXS"
          icon={ClockUserIcon}
          name="Clock Out"
          onClick={async () => {
            await clockOutAttendanceActivity(selectedRow.id);
          }}
        />
      )}

      {/* NOTES */}
      {selectedRow.notes && (
        <div className="generalCard blueCard cardPaddingSmall">
          <p className="textBold textXS">Notes:</p>
          <p className="textRegular textXXS">{selectedRow.notes}</p>
        </div>
      )}

      {/* REJECTION REASON */}
      {selectedRow.approval_status === "Approved" && (
        <div className="attendanceCardSidebarDetailsContainer">
          <div className="generalCard greenCard cardWidth cardPaddingSmall">
            <Link
              className="textBold textXXXS"
              to={`/app/employees/${selectedRow.approved_by}`}
            >
              Approved By:{" "}
              <span className="textRegular textXXXS">
                {selectedRow.approved_by_name}
              </span>
            </Link>
          </div>
        </div>
      )}

      {/* REJECTION REASON */}
      {selectedRow.approval_status === "Rejected" && (
        <div className="attendanceCardSidebarDetailsContainer">
          <div className="generalCard redCard cardWidth cardPaddingSmall">
            <Link
              className="textBold textXXXS"
              to={`/app/employees/${selectedRow.approved_by}`}
            >
              Rejected By:{" "}
              <span className="textRegular textXXXS">
                {selectedRow.approved_by_name}
              </span>
            </Link>
          </div>
          <div className="generalCard redCard cardPaddingSmall">
            <p className="textBold textXS">Rejection Reason:</p>
            <p className="textRegular textXXS">
              {selectedRow.rejection_reason}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
