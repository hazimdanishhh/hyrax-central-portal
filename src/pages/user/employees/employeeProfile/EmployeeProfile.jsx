import { useNavigate, useParams } from "react-router-dom";
import useEmployeePublicProfile from "../../../../hooks/useEmployeePublicProfile";
import LoadingIcon from "../../../../components/loadingIcon/LoadingIcon";
import { User, UsersFour, UsersThree } from "phosphor-react";
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
import EmployeeCard from "../../../../components/employeeCard/EmployeeCard";

export default function EmployeeProfile() {
  const navigate = useNavigate();
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
              current={
                employee.preferred_name
                  ? `${employee.preferred_name}'s Profile`
                  : `Employee's Profile`
              }
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
                  <SectionHeader
                    title={`${employee.preferred_name}'s Employee Information`}
                    icon={User}
                  />

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
                    <SectionHeader
                      title={`${employee.preferred_name}'s Reporting Manager`}
                      icon={UsersThree}
                    />
                    <EmployeeCard
                      className="employeeCard"
                      onClick={() =>
                        navigate(`/app/employees/${employee.manager_id}`)
                      }
                      src={employee.manager_avatar_url}
                      full_name={employee.manager_name}
                      position={employee.manager_position}
                      employee_id={employee.manager_employee_id}
                      department_name={employee.manager_department_name}
                      email_work={employee.manager_email}
                      phone_work={employee.manager_phone}
                      employment_status_name={
                        employee.manager_employment_status_name
                      }
                    />
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
