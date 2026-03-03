import { useState } from "react";
import { useTheme } from "../../../context/ThemeContext";
import useUserProfile from "../../../hooks/useUserProfile";
import LoadingIcon from "../../../components/loadingIcon/LoadingIcon";
import useEmployee from "../../../hooks/useEmployee";
import CardSection from "../../../components/cardSection/CardSection";
import CardLayout from "../../../components/cardLayout/CardLayout";
import { useNavigate } from "react-router";
import EmployeeCard from "../../../components/employeeCard/EmployeeCard";
import SectionHeader from "../../../components/sectionHeader/SectionHeader";
import { UsersFourIcon } from "@phosphor-icons/react";
import useEmployees from "../../../hooks/useEmployees";

export default function Users() {
  const navigate = useNavigate();
  const { darkMode } = useTheme();
  const { loading: profileLoading } = useUserProfile();
  const { employee } = useEmployee();

  const { employees, loading: employeesLoading } = useEmployees();

  if (profileLoading || employeesLoading) {
    return <LoadingIcon />;
  }

  return (
    <>
      <section className={darkMode ? "sectionDark" : "sectionLight"}>
        <div className="sectionWrapper">
          <div className="sectionContent">
            <CardSection>
              <div className="departmentHeader">
                <SectionHeader title="EMPLOYEES" icon={UsersFourIcon} />
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
