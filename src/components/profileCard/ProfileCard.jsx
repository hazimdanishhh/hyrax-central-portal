import { useRef } from "react";
import {
  CameraIcon,
  DesktopIcon,
  PencilSimpleIcon,
} from "@phosphor-icons/react";
import { profileData } from "../../data/profileData";
import CardLayout from "../cardLayout/CardLayout";
import CardSection from "../cardSection/CardSection";
import "./ProfileCard.scss";
import Button from "../buttons/button/Button";
import StatusBadge from "../status/statusBadge/StatusBadge";
import SectionHeader from "../sectionHeader/SectionHeader";
import { Link } from "react-router";
import RouterButton from "../buttons/routerButton/RouterButton";
import AttendanceType from "../attendance/attendanceType/AttendanceType";
import { useProfile } from "../../context/ProfileContext";
import { useAccessControl } from "../../context/AccessControlContext";
import { useUpdateOwnAvatar } from "../../features/profile/hooks/useUpdateOwnAvatar";

export default function ProfileCard({
  profile,
  employee,
  employeePublic,
  assets,
}) {
  const sources = {
    profile,
    employee,
    employeePublic,
  };

  const { refetchProfile } = useProfile();
  const { canAccess } = useAccessControl();
  const avatarInputRef = useRef();
  const { updateAvatar, updating: updatingAvatar } = useUpdateOwnAvatar(
    profile?.id,
    refetchProfile,
  );

  return (
    <div className="profileCard">
      <CardSection>
        <div className="profileOverview">
          <div className="profilePhoto">
            <img
              src={profile?.avatar_url || `/profilePhoto/default.webp`}
              alt={profile?.full_name}
            />

            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) updateAvatar(file);
                e.target.value = "";
              }}
            />

            <Button
              icon={CameraIcon}
              style="profilePhotoChangeButton"
              disabled={updatingAvatar}
              onClick={() => avatarInputRef.current.click()}
            />
          </div>
          <div className="profileOverviewDetails">
            <p className="textBold textM">{profile?.full_name}</p>
            <p className="textLight textS">{employee?.department?.name}</p>
            <p className="textLight textXXS">{employee?.position}</p>
            <StatusBadge status={employee?.employment_status?.name} />
          </div>
        </div>
      </CardSection>

      {profileData.map((section, index) => {
        const data = sources[section.source];

        return (
          <div key={index} className="profileSection">
            <CardSection>
              <div className="profileSectionHeader">
                <SectionHeader title={section.title} icon={section.icon} />

                {/* Edit shortcut: only where the destination
                    (/app/hr/employees/list) is actually reachable to this
                    user -- same gate as that route's own AccessRoute. */}
                {section.source === "employee" &&
                  canAccess({ departments: ["HR"] }) && (
                    <RouterButton
                      to={`/app/hr/employees/list/?employeeId=${employee?.id}`}
                      style="button buttonType5 textXXS"
                      icon={PencilSimpleIcon}
                    />
                  )}
              </div>
              <CardLayout
                style={
                  section.title === "Address Information"
                    ? "cardLayout2"
                    : "cardLayout3"
                }
              >
                {section.fields.map((field) => (
                  <div key={field.label} className="profileDetails">
                    <strong className="profileLabel textXXS">
                      {field.label}
                    </strong>
                    <p
                      key={field.label}
                      className="profileData textRegular textXXS"
                    >
                      {field.value(data) || `-`}
                    </p>
                    {/* <input
                      type="text"
                      key={field.label}
                      className="profileData textRegular textXXS"
                      value={field.value(data)}
                      readOnly
                    /> */}
                  </div>
                ))}
              </CardLayout>
            </CardSection>
          </div>
        );
      })}

      {/* Render Assets separately */}
      {assets?.length > 0 && (
        <div className="profileSection">
          <CardSection>
            <div className="profileSectionHeader">
              <SectionHeader title="Assigned Assets" icon={DesktopIcon} />
            </div>
            <CardLayout style="cardLayout3">
              {assets.map((asset) => (
                <div key={asset.asset_code} className="assetCard">
                  <strong className="profileLabel textXXS">
                    {asset.asset_code} - {asset.asset_name}
                  </strong>
                  <p className="textRegular textXXS">
                    {asset.asset_category?.name}/{asset.asset_subcategory?.name}
                  </p>
                  <p className="textRegular textXXS">
                    Status: {asset.asset_status?.name}
                  </p>
                  <p className="textRegular textXXS">
                    Manufacturer: {asset.asset_manufacturer?.name} | Model:{" "}
                    {asset.asset_model}
                  </p>
                  <p className="textRegular textXXS">
                    Condition: {asset.asset_condition?.name} | Location:{" "}
                    {asset.asset_location?.name}
                  </p>
                </div>
              ))}
            </CardLayout>
          </CardSection>
        </div>
      )}
    </div>
  );
}
