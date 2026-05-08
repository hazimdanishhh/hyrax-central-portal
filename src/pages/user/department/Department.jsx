import { useState } from "react";
import { useTheme } from "../../../context/ThemeContext";
import LoadingIcon from "../../../components/loadingIcon/LoadingIcon";
import CardSection from "../../../components/cardSection/CardSection";
import CardLayout from "../../../components/cardLayout/CardLayout";
import "./Department.scss";
import { useNavigate } from "react-router";
import EmployeeCard from "../../../components/employeeCard/EmployeeCard";
import SectionHeader from "../../../components/sectionHeader/SectionHeader";
import { UserCircleIcon, UsersThreeIcon } from "@phosphor-icons/react";
import CardWrapper from "../../../components/cardWrapper/CardWrapper";
import Breadcrumbs from "../../../components/breadcrumbs/Breadcrumbs";
import { useEmployee } from "../../../context/EmployeeContext";
import NoResult from "../../../components/crud/noResult/NoResult";
import useDepartmentEmployeesPublic from "../../../features/hr/employees/public/hooks/useDepartmentEmployeesPublic";
import useSubordinatesPublic from "../../../features/hr/employees/public/hooks/useSubordinatesPublic";
import useEmployeePublic from "../../../features/hr/employees/public/hooks/useEmployeePublic";

export default function Department() {
  const navigate = useNavigate();
  const { darkMode } = useTheme();
  const {
    employee,
    loading: employeeLoading,
    error: employeeError,
  } = useEmployee();

  const {
    data: employeePublic,
    isLoading: employeePublicLoad,
    error: employeePublicError,
  } = useEmployeePublic(employee?.id);

  const manager = employeePublic?.manager_id
    ? {
        id: employeePublic.manager_id,
        full_name: employeePublic.manager_name,
        employee_id: employeePublic.manager_employee_id,
        profile_id: employeePublic.manager_profile_id,
        preferred_name: employeePublic.manager_preferred_name,
        position: employeePublic.manager_position,
        phone_work: employeePublic.manager_phone,
        email_work: employeePublic.manager_email,
        address_work: employeePublic.manager_address_work,
        avatar_url: employeePublic.manager_avatar_url,
        department_name: employeePublic.manager_department_name,
        employment_status_name: employeePublic.manager_employment_status_name,
      }
    : null;

  const {
    data: departmentEmployees,
    isLoading: departmentEmployeesLoading,
    error: departmentEmployeesError,
  } = useDepartmentEmployeesPublic(employee?.department?.id);

  const {
    data: subordinates,
    isLoading: subordinatesLoading,
    error: subordinatesError,
  } = useSubordinatesPublic(employee?.id);

  const loading =
    employeeLoading || departmentEmployeesLoading || subordinatesLoading;
  const error = employeeError || departmentEmployeesError || subordinatesError;

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
