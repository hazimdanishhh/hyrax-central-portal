import { PencilSimple } from "phosphor-react";
import { profileData } from "../../data/profileData";
import CardLayout from "../cardLayout/CardLayout";
import CardSection from "../cardSection/CardSection";
import "./ProfileCard.scss";
import Button from "../buttons/button/Button";
import EmployeeStatus from "../status/employeeStatus/EmployeeStatus";

export default function ProfileCard({ profile, employee, assets }) {
  if (!profile || !employee) return null;
  console.log(assets);

  const sources = {
    profile,
    employee,
  };

  return (
    <div className="profileCard">
      <h1 className="textBold textL">My Profile</h1>

      <CardSection>
        <div className="profileOverview">
          <div className="profilePhoto">
            <img
              src={profile?.avatar_url || `/profilePhoto/default.webp`}
              alt={profile?.full_name}
            />
          </div>
          <div className="profileOverviewDetails">
            <p className="textBold textM">{profile?.full_name}</p>
            <p className="textLight textS">{employee?.department?.name}</p>
            <p className="textLight textXXS">{employee?.position}</p>
            <EmployeeStatus status={employee?.employment_status?.name} />
          </div>
        </div>
      </CardSection>

      {profileData.map((section, index) => {
        const data = sources[section.source];

        return (
          <div key={index} className="profileSection">
            <CardSection>
              <div className="profileSectionHeader">
                <h2 className="textBold textS">{section.title}</h2>
                {index === 0 && profile.role !== "superadmin" ? null : (
                  <Button
                    name="Edit Profile"
                    icon2={PencilSimple}
                    style="button buttonType3"
                  />
                )}
              </div>
              <CardLayout style="cardLayout3">
                {section.fields.map((field) => (
                  <div key={field.label} className="profileDetails">
                    <strong className="profileLabel textXXS">
                      {field.label}
                    </strong>
                    <p
                      key={field.label}
                      className="profileData textRegular textXXS"
                    >
                      {field.value(data) || `null`}
                    </p>
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
              <h2 className="textBold textS">Asset Information</h2>
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
                    Manufacturer: {asset.manufacturer?.name} | Model:{" "}
                    {asset.model?.name}
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
