import { useState } from "react";
import MessageUI from "../../../components/messageUI/MessageUI";
import { useTheme } from "../../../context/ThemeContext";
import useUserProfile from "../../../hooks/useUserProfile";
import LoadingIcon from "../../../components/loadingIcon/LoadingIcon";
import useEmployee from "../../../hooks/useEmployee";
import useDepartmentEmployees from "../../../hooks/useDepartmentEmployees";
import CardSection from "../../../components/cardSection/CardSection";
import CardLayout from "../../../components/cardLayout/CardLayout";
import "./Department.scss";
import {
  Envelope,
  IdentificationBadge,
  Phone,
  UserCircle,
  UsersThree,
} from "phosphor-react";
import useReportingManager from "../../../hooks/useReportingManager";
import { useNavigate } from "react-router";

export default function Department() {
  const navigate = useNavigate();
  const [message, setMessage] = useState({ text: "", type: "" });
  const { darkMode } = useTheme();
  const { loading: profileLoading } = useUserProfile({ setMessage });
  const { employee } = useEmployee();

  const { manager: reportingManager, loading: managerLoading } =
    useReportingManager(employee?.profile_id, { setMessage });

  const { employees, loading: employeesLoading } = useDepartmentEmployees(
    employee?.department?.id,
    { setMessage },
  );

  console.log(reportingManager);

  if (profileLoading || employeesLoading || managerLoading) {
    return <LoadingIcon />;
  }

  return (
    <>
      <MessageUI message={message} setMessage={setMessage} />

      <section className={darkMode ? "sectionDark" : "sectionLight"}>
        <div className="sectionWrapper">
          <div className="sectionContent departmentSectionContent">
            <CardSection>
              <div className="departmentHeader">
                <h2 className="textRegular textL">My Reporting Manager</h2>
              </div>
              <div className="profileOverview">
                <div className="profilePhoto">
                  <img
                    src={
                      reportingManager?.avatar_url ||
                      "/profilePhoto/default.webp"
                    }
                    alt={reportingManager?.full_name}
                  />
                </div>

                <div className="profileOverviewDetails">
                  <p className="textBold textM">
                    {reportingManager?.full_name}
                    <span className="textRegular textXS">
                      ({reportingManager?.preferred_name})
                    </span>
                  </p>
                  <p className="textLight textXXS">
                    <IdentificationBadge />
                    {reportingManager?.employee_id}
                  </p>
                  <p className="textLight textXXS">
                    <UsersThree />
                    {reportingManager?.department_name}
                  </p>
                  <p className="textLight textXXS">
                    <UserCircle />
                    {reportingManager?.position}
                  </p>
                  <p className="textLight textXXS">
                    <Envelope /> {reportingManager?.email_work}
                  </p>
                  <p className="textLight textXXS">
                    <Phone /> {reportingManager?.phone_work}
                  </p>
                </div>
              </div>
            </CardSection>

            <CardSection>
              <div className="departmentHeader">
                <h2 className="textRegular textL">My Department</h2>
                <h3 className="textRegular textS managerBadge">
                  {employee?.department?.name}
                </h3>
              </div>

              <CardLayout style="cardLayout2">
                {employees.map((emp) => {
                  const isMyManager = emp.profile_id === employee?.manager?.id;
                  const isMe = emp.profile_id === employee?.profile_id;

                  return (
                    <div
                      key={emp.id}
                      className="departmentCard"
                      onClick={() =>
                        navigate(`/app/employee/${emp.profile_id}`)
                      }
                    >
                      <div className="profilePhoto departmentPhoto">
                        <img
                          src={emp.avatar_url || "/profilePhoto/default.webp"}
                          alt={emp.full_name}
                        />
                      </div>

                      <div className="profileOverviewDetails">
                        <p className="textBold textM">
                          {emp.full_name}
                          <span className="textRegular textXS">
                            ({emp.preferred_name})
                          </span>
                        </p>
                        <p className="textLight textXXS">
                          <IdentificationBadge />
                          {emp.employee_id}
                        </p>
                        <p className="textLight textXXS">
                          <UsersThree />
                          {emp.department_name}
                        </p>
                        <p className="textLight textXXS">
                          <UserCircle />
                          {emp.position}
                        </p>

                        <p className="textLight textXXS">
                          <Envelope /> {emp.email_work}
                        </p>
                        <p className="textLight textXXS">
                          <Phone /> {emp.phone_work}
                        </p>

                        {isMyManager && (
                          <p className="managerBadge textXXS">
                            Reporting Manager
                          </p>
                        )}
                        {isMe && <p className="managerBadge textXXS">Me</p>}
                      </div>
                    </div>
                  );
                })}
              </CardLayout>
            </CardSection>
          </div>
        </div>
      </section>
    </>
  );
}
