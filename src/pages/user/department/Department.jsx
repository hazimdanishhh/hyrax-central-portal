import { useMemo } from "react";
import { useNavigate } from "react-router";
import { ReactFlow, Background, Controls, MiniMap } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { TreeStructureIcon } from "@phosphor-icons/react";

import { useTheme } from "../../../context/ThemeContext";
import { useEmployee } from "../../../context/EmployeeContext";
import useAllEmployeesPublic from "../../../features/hr/employees/public/hooks/useAllEmployeesPublic";
import {
  buildOrganizationTree,
  getManagerSubtreeIds,
} from "../../../functions/buildOrganizationTree";
import EmployeeNode from "../../../components/organizationChart/employeeNode/EmployeeNode";
import LoadingIcon from "../../../components/loadingIcon/LoadingIcon";
import CardWrapper from "../../../components/cardWrapper/CardWrapper";
import CardLayout from "../../../components/cardLayout/CardLayout";
import Breadcrumbs from "../../../components/breadcrumbs/Breadcrumbs";
import NoResult from "../../../components/crud/noResult/NoResult";
import "./Department.scss";

const nodeTypes = { employee: EmployeeNode };

// employees_public is flat (manager_* fields only on the row's own manager) --
// buildOrganizationTree/EmployeeNode expect the same nested shape the
// private-table org chart uses (department/profile as objects), so each row
// is adapted once here rather than teaching the shared tree-builder/node
// renderer two different input shapes.
function toTreeEmployee(row) {
  return {
    id: row.id,
    full_name: row.full_name,
    position: row.position,
    manager_id: row.manager_id,
    department_id: row.department_id,
    department: { id: row.department_id, name: row.department_name },
    profile: { avatar_url: row.avatar_url },
  };
}

export default function Department() {
  const navigate = useNavigate();
  const { darkMode } = useTheme();
  const {
    employee,
    loading: employeeLoading,
    error: employeeError,
  } = useEmployee();

  const {
    data: allEmployeesPublic,
    isLoading: allEmployeesLoading,
    error: allEmployeesError,
  } = useAllEmployeesPublic();

  const isLoading = employeeLoading || allEmployeesLoading;
  const error = employeeError || allEmployeesError;

  // Root the chart at the current user's manager -- the ask ("only based on
  // the current user's manager"). Falls back to the current user's own id
  // when they have no manager on file (e.g. the top of the company), so that
  // case shows their own team instead of an empty page.
  const rootId = employee?.manager_id || employee?.id || null;

  const { nodes, edges, visibleCount } = useMemo(() => {
    if (!rootId || !allEmployeesPublic) {
      return { nodes: [], edges: [], visibleCount: 0 };
    }

    const subtreeIds = getManagerSubtreeIds(allEmployeesPublic, rootId);
    const subtreeEmployees = allEmployeesPublic
      .filter((row) => subtreeIds.has(row.id))
      .map(toTreeEmployee);

    const { nodes: builtNodes, edges: builtEdges } = buildOrganizationTree(
      subtreeEmployees,
      employee?.id,
    );

    return {
      nodes: builtNodes,
      edges: builtEdges,
      visibleCount: subtreeEmployees.length,
    };
  }, [allEmployeesPublic, rootId, employee?.id]);

  function handleNodeClick(_event, node) {
    navigate(`/app/employees/${node.id}`);
  }

  return (
    <section className={darkMode ? "sectionDark" : "sectionLight"}>
      <div className="sectionWrapper">
        <div className="sectionContent">
          <Breadcrumbs icon={TreeStructureIcon} current="My Reporting Line" />

          <CardWrapper>
            {isLoading ? (
              <CardLayout style="cardLayoutFlexFull">
                <LoadingIcon />
              </CardLayout>
            ) : error ? (
              <CardLayout style="cardLayoutFlexFull">
                <NoResult title="Error loading your reporting line." />
              </CardLayout>
            ) : nodes.length === 0 ? (
              <CardLayout style="cardLayoutFlexFull">
                <NoResult title="No reporting line on file for your account yet." />
              </CardLayout>
            ) : (
              <>
                <p className="textLight textXXS departmentOrgChartCount">
                  Showing {visibleCount}{" "}
                  {visibleCount === 1 ? "person" : "people"} in your reporting
                  line
                </p>

                <div className="departmentOrgChartCanvas">
                  <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    nodeTypes={nodeTypes}
                    fitView
                    colorMode={darkMode ? "dark" : "light"}
                    nodesConnectable={false}
                    elementsSelectable={false}
                    onNodeClick={handleNodeClick}
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
