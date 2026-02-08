import { useState } from "react";
import MessageUI from "../../../components/messageUI/MessageUI";
import { useTheme } from "../../../context/ThemeContext";
import useUserProfile from "../../../hooks/useUserProfile";
import LoadingIcon from "../../../components/loadingIcon/LoadingIcon";
import useEmployee from "../../../hooks/useEmployee";
import CardSection from "../../../components/cardSection/CardSection";
import CardLayout from "../../../components/cardLayout/CardLayout";
import { useNavigate } from "react-router";
import EmployeeCard from "../../../components/employeeCard/EmployeeCard";
import SectionHeader from "../../../components/sectionHeader/SectionHeader";
import { UsersFour } from "phosphor-react";
import useEmployees from "../../../hooks/useEmployees";

export default function Users() {
  const navigate = useNavigate();
  const [message, setMessage] = useState({ text: "", type: "" });
  const { darkMode } = useTheme();
  const { loading: profileLoading } = useUserProfile({ setMessage });
  const { employee } = useEmployee();

  const { employees, loading: employeesLoading } = useEmployees({ setMessage });

  if (profileLoading || employeesLoading) {
    return <LoadingIcon />;
  }

  return (
    <>
      <MessageUI message={message} setMessage={setMessage} />

      <section className={darkMode ? "sectionDark" : "sectionLight"}>
        <div className="sectionWrapper">
          <div className="sectionContent">
            <CardSection>
              <div className="departmentHeader">
                <SectionHeader title="EMPLOYEES" icon={UsersFour} />
              </div>

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
            </CardSection>
          </div>
        </div>
      </section>
    </>
  );
}
