import { useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { TreeStructureIcon } from "@phosphor-icons/react";

import { useTheme } from "../../../../context/ThemeContext";
import { useOrganizationHierarchy } from "../../../../features/hr/employees/private/hooks/useOrganizationHierarchy";
import Breadcrumbs from "../../../../components/breadcrumbs/Breadcrumbs";
import CardWrapper from "../../../../components/cardWrapper/CardWrapper";
import CardLayout from "../../../../components/cardLayout/CardLayout";
import LoadingIcon from "../../../../components/loadingIcon/LoadingIcon";
import NoResult from "../../../../components/crud/noResult/NoResult";
import SearchFilterBar from "../../../../components/searchFilterBar/SearchFilterBar";
import EmployeeNode from "../../../../components/organizationChart/employeeNode/EmployeeNode";
import "./OrganizationChart.scss";

const nodeTypes = { employee: EmployeeNode };

function OrganizationChart() {
  const { darkMode } = useTheme();
  const [filters, setFilters] = useState({ department: "", manager: "" });

  const {
    nodes,
    edges,
    managers,
    departments,
    totalActiveCount,
    visibleCount,
    isLoading,
    error,
  } = useOrganizationHierarchy({
    departmentId: filters.department || null,
    managerId: filters.manager || null,
  });

  const filterConfig = useMemo(
    () => [
      {
        key: "manager",
        label: "Manager",
        options: managers.map((m) => ({ label: m.full_name, value: m.id })),
      },
      {
        key: "department",
        label: "Department",
        options: departments.map((d) => ({ label: d.name, value: d.id })),
      },
    ],
    [managers, departments],
  );

  return (
    <section className={darkMode ? "sectionDark" : "sectionLight"}>
      <div className="sectionWrapper">
        <div className="sectionContent">
          <Breadcrumbs icon={TreeStructureIcon} current="Organization Chart" />

          <CardWrapper>
            <SearchFilterBar
              filters={filters}
              onFilterChange={setFilters}
              filterConfig={filterConfig}
              disableSearch
            />

            {isLoading ? (
              <CardLayout style="cardLayoutFlexFull">
                <LoadingIcon />
              </CardLayout>
            ) : error ? (
              <CardLayout style="cardLayoutFlexFull">
                <NoResult title="Error loading organization structure." />
              </CardLayout>
            ) : nodes.length === 0 ? (
              <CardLayout style="cardLayoutFlexFull">
                <NoResult title="No active employees found." />
              </CardLayout>
            ) : (
              <>
                <p className="textLight textXXS orgChartCount">
                  Showing {visibleCount} of {totalActiveCount} active
                  employees
                  {filters.manager && " (filtered to this manager's team)"}
                </p>

                <div className="orgChartCanvas">
                  <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    nodeTypes={nodeTypes}
                    fitView
                    colorMode={darkMode ? "dark" : "light"}
                    nodesConnectable={false}
                    elementsSelectable={false}
                  >
                    <Background />
                    <Controls showInteractive={false} />
                    <MiniMap pannable zoomable />
                  </ReactFlow>
                </div>
              </>
            )}
          </CardWrapper>
        </div>
      </div>
    </section>
  );
}

export default OrganizationChart;
