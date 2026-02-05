import { useParams } from "react-router-dom";
import useEmployeePublicProfile from "../../../../hooks/useEmployeePublicProfile";
import LoadingIcon from "../../../../components/loadingIcon/LoadingIcon";
import {
  Envelope,
  IdentificationBadge,
  Phone,
  UserCircle,
  UsersThree,
} from "phosphor-react";
import CardSection from "../../../../components/cardSection/CardSection";
import MessageUI from "../../../../components/messageUI/MessageUI";
import { useState } from "react";
import { useTheme } from "../../../../context/ThemeContext";
import CardLayout from "../../../../components/cardLayout/CardLayout";
import EmployeeStatus from "../../../../components/status/employeeStatus/EmployeeStatus";

export default function EmployeeProfile() {
  const [message, setMessage] = useState({ text: "", type: "" });
  const { darkMode } = useTheme();

  const { profileId } = useParams();
  const { employee, loading, error } = useEmployeePublicProfile(profileId);

  if (loading) return <LoadingIcon />;

  if (error || !employee) {
    return <p>Employee not found</p>;
  }

  return (
    <>
      <MessageUI message={message} setMessage={setMessage} />

      <section className={darkMode ? "sectionDark" : "sectionLight"}>
        <div className="sectionWrapper">
          <div className="sectionContent departmenSectionContent">
            <CardSection>
              <div className="departmentHeader">
                <h2 className="textRegular textL">
                  {employee.preferred_name}'s Profile
                </h2>
              </div>
              <div className="profileOverview">
                <div className="profilePhoto">
                  <img
                    src={employee.avatar_url || "/profilePhoto/default.webp"}
                    alt={employee.full_name}
                  />
                </div>

                <div className="profileOverviewDetails">
                  <p className="textBold textM">
                    {employee.full_name}
                    <span className="textRegular textXS">
                      ({employee.preferred_name})
                    </span>
                  </p>
                  <p className="textLight textXXS">
                    {employee.department_name}
                  </p>
                  <p className="textLight textXXS">{employee.position}</p>
                  <EmployeeStatus status={employee.employment_status} />
                </div>
              </div>
            </CardSection>

            <CardSection>
              <div className="profileSectionHeader">
                <h2 className="textBold textS">Personal Information</h2>
              </div>

              <CardLayout style="cardLayout3">
                <div className="profileDetails">
                  <strong className="profileLabel textXXS">Department</strong>
                  <p className="profileData textRegular textXXS">
                    {employee.department_name || null}
                  </p>
                </div>
                <div className="profileDetails">
                  <strong className="profileLabel textXXS">Position</strong>
                  <p className="profileData textRegular textXXS">
                    {employee.position || null}
                  </p>
                </div>
                <div className="profileDetails">
                  <strong className="profileLabel textXXS">Email (Work)</strong>
                  <p className="profileData textRegular textXXS">
                    {employee.email_work || null}
                  </p>
                </div>
                <div className="profileDetails">
                  <strong className="profileLabel textXXS">Phone (Work)</strong>
                  <p className="profileData textRegular textXXS">
                    {employee.phone_work || null}
                  </p>
                </div>

                <div className="profileDetails">
                  <strong className="profileLabel textXXS">Employee ID</strong>
                  <p className="profileData textRegular textXXS">
                    {employee.employee_id || null}
                  </p>
                </div>
                <div className="profileDetails">
                  <strong className="profileLabel textXXS">System ID</strong>
                  <p className="profileData textRegular textXXS">
                    {employee.profile_id || null}
                  </p>
                </div>
              </CardLayout>
              <CardLayout style="cardLayout1">
                <div className="profileDetails">
                  <strong className="profileLabel textXXS">
                    Address (Work)
                  </strong>
                  <p className="profileData textRegular textXXS">
                    {employee.address_work || null}
                  </p>
                </div>
              </CardLayout>
            </CardSection>

            {employee.manager_name && (
              <CardSection>
                <div className="departmentHeader">
                  <h2 className="textRegular textL">
                    {employee.preferred_name}'s Reporting Manager
                  </h2>
                </div>
                <div className="profileOverview">
                  <div className="profilePhoto">
                    <img
                      src={
                        employee.manager_avatar_url ||
                        "/profilePhoto/default.webp"
                      }
                      alt={employee.manager_name}
                    />
                  </div>

                  <div className="profileOverviewDetails">
                    <p className="textBold textM">
                      {employee.manager_name}{" "}
                      <span className="textRegular textXS">
                        ({employee.manager_preferred_name})
                      </span>
                    </p>
                    <p className="textLight textXXS">
                      <IdentificationBadge /> {employee.manager_employee_id}
                    </p>
                    <p className="textLight textXXS">
                      <UsersThree /> {employee.manager_department_name}
                    </p>
                    <p className="textLight textXXS">
                      <UserCircle /> {employee.manager_position}
                    </p>
                    <p className="textLight textXXS">
                      <Envelope /> {employee.manager_email}
                    </p>
                    <p className="textLight textXXS">
                      <Phone /> {employee.manager_phone}
                    </p>
                  </div>
                </div>
              </CardSection>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
