import { useNavigate, useParams } from "react-router-dom";
import LoadingIcon from "../../../../components/loadingIcon/LoadingIcon";
import { UserIcon, UsersFourIcon, UsersThreeIcon } from "@phosphor-icons/react";
import CardSection from "../../../../components/cardSection/CardSection";
import { useState } from "react";
import { useTheme } from "../../../../context/ThemeContext";
import CardLayout from "../../../../components/cardLayout/CardLayout";
import StatusBadge from "../../../../components/status/statusBadge/StatusBadge";
import SectionHeader from "../../../../components/sectionHeader/SectionHeader";
import RouterButton from "../../../../components/buttons/routerButton/RouterButton";
import Breadcrumbs from "../../../../components/breadcrumbs/Breadcrumbs";
import CardWrapper from "../../../../components/cardWrapper/CardWrapper";
import EmployeeCard from "../../../../components/employeeCard/EmployeeCard";
import AttendanceType from "../../../../components/attendance/attendanceType/AttendanceType";
import useEmployeePublic from "../../../../hooks/employeesPublic/useEmployeePublic";
import NoResult from "../../../../components/crud/noResult/NoResult";

export default function EmployeeProfile() {
  const navigate = useNavigate();
  const { darkMode } = useTheme();

  const { employeeId } = useParams();
  const { employee, loading, error } = useEmployeePublic(employeeId);

  return (
    <>
      <section className={darkMode ? "sectionDark" : "sectionLight"}>
        <div className="sectionWrapper">
          <div className="sectionContent">
            <Breadcrumbs
              icon1={UsersFourIcon}
              current={
                employee && employee.preferred_name
                  ? `${employee.preferred_name}'s Profile`
                  : `Employee's Profile`
              }
              to1="/app/employees"
              name1="Employees"
            />

            {loading ? (
              <LoadingIcon />
            ) : error ? (
              <NoResult title="Employee Not Found" />
            ) : (
              <>
                <CardWrapper>
                  <CardLayout style="cardLayout1">
                    <CardSection>
                      <div className="profileOverview">
                        <div className="profilePhoto">
                          <img
                            src={
                              employee.avatar_url ||
                              "/profilePhoto/default.webp"
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
                          <StatusBadge
                            status={employee.employment_status_name}
                          />
                          <AttendanceType
                            attendanceType={
                              employee.current_attendance_type_name ||
                              "Not In Office"
                            }
                          />
                        </div>
                      </div>
                    </CardSection>

                    <CardSection>
                      <SectionHeader
                        title={`${employee.preferred_name}'s Employee Information`}
                        icon={UserIcon}
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
                          <strong className="profileLabel textXXS">
                            Position
                          </strong>
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
                          icon={UsersThreeIcon}
                        />
                        <EmployeeCard
                          className="employeeCard"
                          onClick={() =>
                            navigate(`/app/employees/${employee.manager_id}`)
                          }
                          employee={employee}
                        />
                      </CardSection>
                    )}
                  </CardLayout>
                </CardWrapper>
              </>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
