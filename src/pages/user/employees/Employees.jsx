import { useState } from "react";
import MessageUI from "../../../components/messageUI/MessageUI";
import { useTheme } from "../../../context/ThemeContext";
import useUserProfile from "../../../hooks/useUserProfile";
import LoadingIcon from "../../../components/loadingIcon/LoadingIcon";
import useEmployee from "../../../hooks/useEmployee";
import CardLayout from "../../../components/cardLayout/CardLayout";
import { useNavigate } from "react-router";
import EmployeeCard from "../../../components/employeeCard/EmployeeCard";
import {
  ListBulletsIcon,
  SquaresFourIcon,
  UsersFourIcon,
} from "@phosphor-icons/react";
import useEmployees from "../../../hooks/useEmployees";
import Breadcrumbs from "../../../components/breadcrumbs/Breadcrumbs";
import CardWrapper from "../../../components/cardWrapper/CardWrapper";
import Button from "../../../components/buttons/button/Button";
import EmployeeList from "../../../components/employeeList/EmployeeList";
import useSearchFilter from "../../../hooks/useSearchFliter";
import useDepartments from "../../../hooks/useDepartments";
import useEmploymentStatus from "../../../hooks/useEmploymentStatus";
import SearchFilterBar from "../../../components/searchFliterBar/SearchFilterBar";

export default function EmployeesList() {
  const navigate = useNavigate();
  const [layout, setLayout] = useState(1); // 1: List, 2: Card
  const [message, setMessage] = useState({ text: "", type: "" });
  const { darkMode } = useTheme();
  const { loading: profileLoading } = useUserProfile({ setMessage });
  const { employee } = useEmployee();
  const { departments } = useDepartments();
  const { statuses: employmentStatuses } = useEmploymentStatus();
  const { employees, loading: employeesLoading } = useEmployees({ setMessage });

  // Filter Config
  const employeeFilterConfig = [
    {
      key: "department",
      label: "Department",
      options: departments.map((d) => d.name),
    },
    {
      key: "status",
      label: "Employment Status",
      options: employmentStatuses.map((s) => s.name),
    },
  ];

  // Search Filter Bar
  const {
    search,
    setSearch,
    filters,
    setFilters,
    data: filteredEmployees,
  } = useSearchFilter({
    data: employees,
    searchFields: ["full_name", "email_work", "employee_id"],
    filterMap: {
      department: (emp, value) => emp.department_name === value,
      status: (emp, value) => emp.employment_status_name === value,
    },
  });

  // Return Loading
  if (profileLoading || employeesLoading) {
    return <LoadingIcon />;
  }

  return (
    <>
      <MessageUI message={message} setMessage={setMessage} />

      <section className={darkMode ? "sectionDark" : "sectionLight"}>
        <div className="sectionWrapper">
          <div className="sectionContent">
            <Breadcrumbs icon={UsersFourIcon} current="Employees" />

            <CardWrapper>
              <div className="itAssetsHeader">
                <SearchFilterBar
                  search={search}
                  onSearchChange={setSearch}
                  filters={filters}
                  onFilterChange={setFilters}
                  filterConfig={employeeFilterConfig}
                  placeholder="Search employees..."
                />

                {layout === 1 ? (
                  <Button
                    icon2={SquaresFourIcon}
                    tooltipName="Card View"
                    style="button buttonType3 textXXS"
                    name="Card View"
                    onClick={() => setLayout(2)}
                  />
                ) : (
                  <Button
                    icon2={ListBulletsIcon}
                    tooltipName="List View"
                    style="button buttonType3 textXXS"
                    name="List View"
                    onClick={() => setLayout(1)}
                  />
                )}
              </div>
              <div className="itAssetsHeader">
                <p className="textRegular textXXS">
                  <strong>Total Result: </strong>
                  {filteredEmployees.length}
                </p>
              </div>
              {layout === 1 ? (
                <CardLayout style="cardLayout1">
                  {filteredEmployees.map((emp) => {
                    const isMyManager = emp.id === employee?.manager_id;

                    return (
                      <EmployeeList
                        key={emp.id}
                        className="employeeList"
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
              ) : (
                <CardLayout style="cardLayout2">
                  {filteredEmployees.map((emp) => {
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
              )}
            </CardWrapper>
          </div>
        </div>
      </section>
    </>
  );
}
