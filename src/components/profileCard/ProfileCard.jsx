import { Desktop, PencilSimple, UserCircle } from "phosphor-react";
import { profileData } from "../../data/profileData";
import CardLayout from "../cardLayout/CardLayout";
import CardSection from "../cardSection/CardSection";
import "./ProfileCard.scss";
import Button from "../buttons/button/Button";
import StatusBadge from "../status/statusBadge/StatusBadge";
import SectionHeader from "../sectionHeader/SectionHeader";

export default function ProfileCard({ profile, employee, assets }) {
  if (!profile || !employee) return null;
  console.log(employee);

  const sources = {
    profile,
    employee,
  };

  return (
    <div className="profileCard">
      {/*  */}
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
                {index === 0 && profile.role !== "superadmin" ? null : (
                  <Button
                    name="Edit Profile"
                    icon2={PencilSimple}
                    style="button buttonType3"
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
              <SectionHeader title="Assigned Assets" icon={Desktop} />
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
