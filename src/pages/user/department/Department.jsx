import { useState } from "react";
import { useTheme } from "../../../context/ThemeContext";
import LoadingIcon from "../../../components/loadingIcon/LoadingIcon";
import useDepartmentEmployees from "../../../hooks/employeesPublic/useDepartmentEmployees";
import CardSection from "../../../components/cardSection/CardSection";
import CardLayout from "../../../components/cardLayout/CardLayout";
import "./Department.scss";
import { useNavigate } from "react-router";
import EmployeeCard from "../../../components/employeeCard/EmployeeCard";
import SectionHeader from "../../../components/sectionHeader/SectionHeader";
import { UserCircleIcon, UsersThreeIcon } from "@phosphor-icons/react";
import CardWrapper from "../../../components/cardWrapper/CardWrapper";
import Breadcrumbs from "../../../components/breadcrumbs/Breadcrumbs";
import useSubordinates from "../../../hooks/employeesPublic/useSubordinates";
import useManagerPublic from "../../../hooks/employeesPublic/useManagerPublic";
import { useEmployee } from "../../../context/EmployeeContext";
import NoResult from "../../../components/crud/noResult/NoResult";

export default function Department() {
  const navigate = useNavigate();
  const { darkMode } = useTheme();
  const {
    employee,
    loading: employeeLoading,
    error: employeeError,
  } = useEmployee();

  const {
    manager,
    loading: managerLoading,
    error: managerError,
  } = useManagerPublic(employee?.employee_id);

  const {
    departmentEmployees,
    loading: departmentEmployeesLoading,
    error: departmentEmployeesError,
  } = useDepartmentEmployees(employee?.department?.id);

  const {
    subordinates,
    loading: subordinatesLoading,
    error: subordinatesError,
  } = useSubordinates();

  const loading =
    employeeLoading ||
    managerLoading ||
    departmentEmployeesLoading ||
    subordinatesLoading;
  const error =
    employeeError ||
    managerError ||
    departmentEmployeesError ||
    subordinatesError;

  return (
    <>
      <section className={darkMode ? "sectionDark" : "sectionLight"}>
        <div className="sectionWrapper">
          <div className="sectionContent">
            <Breadcrumbs
              icon={UsersThreeIcon}
              current={`My Department: ${employee?.department?.name || null}`}
            />
            {loading ? (
              <LoadingIcon />
            ) : error ? (
              <NoResult />
            ) : (
              <CardWrapper>
                {/* MY REPORTING MANAGER SECTION */}
                {manager && (
                  <CardLayout style="generalCard">
                    <Breadcrumbs
                      icon={UserCircleIcon}
                      current="My Reporting Manager"
                    />
                    <CardLayout style="cardLayout2">
                      <EmployeeCard
                        className="employeeCard"
                        onClick={() =>
                          navigate(`/app/employees/${manager?.id}`)
                        }
                        employee={manager}
                      />
                    </CardLayout>
                  </CardLayout>
                )}

                {/* MY DEPARTMENT SECTION */}
                {employee?.department_id && (
                  <CardLayout style="generalCard">
                    <Breadcrumbs
                      icon={UsersThreeIcon}
                      current="My Department"
                    />
                    <CardLayout style="cardLayout2">
                      {departmentEmployees.map((emp) => {
                        const isMyManager = emp.id === employee?.manager_id;

                        return (
                          <EmployeeCard
                            key={emp.id}
                            className="employeeCard"
                            onClick={() => navigate(`/app/employees/${emp.id}`)}
                            employee={emp}
                            isMyManager={isMyManager}
                          />
                        );
                      })}
                    </CardLayout>
                  </CardLayout>
                )}

                {/* MY SUBORDINATES SECTION */}
                {subordinates && (
                  <CardLayout style="generalCard">
                    <Breadcrumbs icon={UsersThreeIcon} current="My Staff" />
                    <CardLayout style="cardLayout2">
                      {subordinates.map((emp) => {
                        return (
                          <EmployeeCard
                            key={emp.id}
                            className="employeeCard"
                            onClick={() => navigate(`/app/employees/${emp.id}`)}
                            employee={emp}
                          />
                        );
                      })}
                    </CardLayout>
                  </CardLayout>
                )}
              </CardWrapper>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
