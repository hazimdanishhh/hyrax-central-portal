import { useParams } from "react-router-dom";
import useEmployeePublicProfile from "../../../../hooks/useEmployeePublicProfile";
import LoadingIcon from "../../../../components/loadingIcon/LoadingIcon";
import {
  CaretRight,
  Envelope,
  IdentificationBadge,
  Phone,
  User,
  UserCircle,
  UsersFour,
  UsersThree,
} from "phosphor-react";
import CardSection from "../../../../components/cardSection/CardSection";
import MessageUI from "../../../../components/messageUI/MessageUI";
import { useState } from "react";
import { useTheme } from "../../../../context/ThemeContext";
import CardLayout from "../../../../components/cardLayout/CardLayout";
import StatusBadge from "../../../../components/status/statusBadge/StatusBadge";
import SectionHeader from "../../../../components/sectionHeader/SectionHeader";
import RouterButton from "../../../../components/buttons/routerButton/RouterButton";
import Breadcrumbs from "../../../../components/breadcrumbs/Breadcrumbs";
import CardWrapper from "../../../../components/cardWrapper/CardWrapper";

export default function EmployeeProfile() {
  const [message, setMessage] = useState({ text: "", type: "" });
  const { darkMode } = useTheme();

  const { employeeId } = useParams();
  const { employee, loading, error } = useEmployeePublicProfile(employeeId);

  console.log(employee);

  if (loading) return <LoadingIcon />;

  if (error || !employee) {
    return <p>Employee not found</p>;
  }

  return (
    <>
      <MessageUI message={message} setMessage={setMessage} />

      <section className={darkMode ? "sectionDark" : "sectionLight"}>
        <div className="sectionWrapper">
          <div className="sectionContent">
            <Breadcrumbs
              icon1={UsersFour}
              current={`${employee.preferred_name}'s Profile`}
              to1="/app/employees"
              name1="Employees"
            />
            <CardWrapper>
              <CardLayout style="cardLayout1">
                <CardSection>
                  <div className="profileOverview">
                    <div className="profilePhoto">
                      <img
                        src={
                          employee.avatar_url || "/profilePhoto/default.webp"
                        }
                        alt={employee.full_name || "No Name"}
                      />
                    </div>

                    <div className="profileOverviewDetails">
                      <p className="textBold textM">
                        {employee.full_name || "No Name"}
                        <span className="textRegular textXS">
                          ({employee.preferred_name || "No Name"})
                        </span>
                      </p>
                      <p className="textLight textXXS">
                        {employee.department_name || "No Department Set"}
                      </p>
                      <p className="textLight textXXS">
                        {employee.position || "No Position Set"}
                      </p>
                      <StatusBadge status={employee.employment_status_name} />
                    </div>
                  </div>
                </CardSection>

                <CardSection>
                  <div className="profileSectionHeader">
                    <h2 className="textBold textS">Personal Information</h2>
                  </div>

                  <CardLayout style="cardLayout3">
                    <div className="profileDetails">
                      <strong className="profileLabel textXXS">
                        Department
                      </strong>
                      <p className="profileData textRegular textXXS">
                        {employee.department_name || "null"}
                      </p>
                    </div>
                    <div className="profileDetails">
                      <strong className="profileLabel textXXS">Position</strong>
                      <p className="profileData textRegular textXXS">
                        {employee.position || "null"}
                      </p>
                    </div>
                    <div className="profileDetails">
                      <strong className="profileLabel textXXS">
                        Email (Work)
                      </strong>
                      <p className="profileData textRegular textXXS">
                        {employee.email_work || "null"}
                      </p>
                    </div>
                    <div className="profileDetails">
                      <strong className="profileLabel textXXS">
                        Phone (Work)
                      </strong>
                      <p className="profileData textRegular textXXS">
                        {employee.phone_work || "null"}
                      </p>
                    </div>

                    <div className="profileDetails">
                      <strong className="profileLabel textXXS">
                        Employee ID
                      </strong>
                      <p className="profileData textRegular textXXS">
                        {employee.employee_id || "null"}
                      </p>
                    </div>
                    <div className="profileDetails">
                      <strong className="profileLabel textXXS">
                        System ID
                      </strong>
                      <p className="profileData textRegular textXXS">
                        {employee.profile_id || "null"}
                      </p>
                    </div>
                  </CardLayout>
                  <CardLayout style="cardLayout1">
                    <div className="profileDetails">
                      <strong className="profileLabel textXXS">
                        Address (Work)
                      </strong>
                      <p className="profileData textRegular textXXS">
                        {employee.address_work || "null"}
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
                        <StatusBadge
                          status={employee.manager_employment_status_name}
                        />
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
              </CardLayout>
            </CardWrapper>
          </div>
        </div>
      </section>
    </>
  );
}
