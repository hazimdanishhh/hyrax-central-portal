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
import useReportingManager from "../../../hooks/useReportingManager";
import { useNavigate } from "react-router";
import EmployeeCard from "../../../components/employeeCard/EmployeeCard";
import SectionHeader from "../../../components/sectionHeader/SectionHeader";
import { UserCircleIcon, UsersThreeIcon } from "@phosphor-icons/react";
import CardWrapper from "../../../components/cardWrapper/CardWrapper";
import Breadcrumbs from "../../../components/breadcrumbs/Breadcrumbs";

export default function Department() {
  const navigate = useNavigate();
  const [message, setMessage] = useState({ text: "", type: "" });
  const { darkMode } = useTheme();
  const { loading: profileLoading } = useUserProfile({ setMessage });
  const { employee } = useEmployee();

  const { manager: reportingManager, loading: managerLoading } =
    useReportingManager(employee?.employee_id, { setMessage });

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
          <div className="sectionContent">
            <Breadcrumbs
              icon={UsersThreeIcon}
              current={`My Department: ${employee?.department?.name}`}
            />
            {/* MY REPORTING MANAGER SECTION */}
            <CardWrapper>
              <Breadcrumbs
                icon={UserCircleIcon}
                current="My Reporting Manager"
              />
              <CardLayout style="cardLayout2">
                <EmployeeCard
                  className="employeeCard"
                  onClick={() =>
                    navigate(`/app/employees/${reportingManager?.id}`)
                  }
                  src={reportingManager?.avatar_url}
                  full_name={reportingManager?.full_name}
                  position={reportingManager?.position}
                  employee_id={reportingManager?.employee_id}
                  department_name={reportingManager?.department_name}
                  email_work={reportingManager?.email_work}
                  phone_work={reportingManager?.phone_work}
                  employment_status_name={
                    reportingManager?.employment_status_name
                  }
                />
              </CardLayout>

              <Breadcrumbs icon={UsersThreeIcon} current="My Department" />
              {/* MY DEPARTMENT SECTION */}
              <CardLayout style="cardLayout2">
                {employees.map((emp) => {
                  const isMyManager = emp.id === employee?.manager_id;

                  return (
                    <EmployeeCard
                      key={emp.id}
                      className="employeeCard"
                      onClick={() => navigate(`/app/employees/${emp.id}`)}
                      src={emp.avatar_url}
                      full_name={emp.full_name}
                      position={emp.position}
                      employee_id={emp.employee_id}
                      department_name={emp.department_name}
                      email_work={emp.email_work}
                      phone_work={emp.phone_work}
                      isMyManager={isMyManager}
                      employment_status_name={emp.employment_status_name}
                    />
                  );
                })}
              </CardLayout>
            </CardWrapper>
          </div>
        </div>
      </section>
    </>
  );
}
