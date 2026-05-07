import { useState } from "react";
import { useTheme } from "../../../context/ThemeContext";
import LoadingIcon from "../../../components/loadingIcon/LoadingIcon";
import CardSection from "../../../components/cardSection/CardSection";
import CardLayout from "../../../components/cardLayout/CardLayout";
import { useNavigate } from "react-router";
import EmployeeCard from "../../../components/employeeCard/EmployeeCard";
import SectionHeader from "../../../components/sectionHeader/SectionHeader";
import { UsersFourIcon } from "@phosphor-icons/react";
import useEmployeesPublic from "../../../hooks/useEmployeesPublic";
import { useEmployee } from "../../../../context/EmployeeContext";

export default function Users() {
  const navigate = useNavigate();
  const { darkMode } = useTheme();
  const { employee } = useEmployee();

  const { employees, loading: employeesLoading } = useEmployeesPublic();

  if (employeesLoading) {
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
                      employee={employee}
                      isMyManager={isMyManager}
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
