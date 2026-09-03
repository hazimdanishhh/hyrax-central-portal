import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { AnimatePresence } from "framer-motion";
import { PencilSimpleLineIcon, TreeStructureIcon } from "@phosphor-icons/react";

import { useTheme } from "../../../../context/ThemeContext";
import { useOrganizationHierarchy } from "../../../../features/hr/employees/private/hooks/useOrganizationHierarchy";
import { useEmployeeById } from "../../../../features/hr/employees/private/hooks/useEmployeeById";
import { useEmployeesMetadata } from "../../../../features/hr/employees/private/hooks/useEmployeesMetadata";
import useEmployeeMutations from "../../../../features/hr/employees/private/hooks/useEmployeeMutations";
import { employeesTableConfig } from "../employeeManagement/list/tableConfig";
import Breadcrumbs from "../../../../components/breadcrumbs/Breadcrumbs";
import CardWrapper from "../../../../components/cardWrapper/CardWrapper";
import CardLayout from "../../../../components/cardLayout/CardLayout";
import LoadingIcon from "../../../../components/loadingIcon/LoadingIcon";
import NoResult from "../../../../components/crud/noResult/NoResult";
import SearchFilterBar from "../../../../components/searchFilterBar/SearchFilterBar";
import EmployeeNode from "../../../../components/organizationChart/employeeNode/EmployeeNode";
import DataSidebar from "../../../../components/dataSidebar/DataSidebar";
import EmployeeSidebar from "../employeeManagement/list/item/EmployeeSidebar";
import ActionModal from "../../../../components/modals/actionModal/ActionModal";
import "./OrganizationChart.scss";

const nodeTypes = { employee: EmployeeNode };

function OrganizationChart() {
  const { darkMode } = useTheme();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({ department: "", manager: "" });

  // Sidebar (view/edit) state -- mirrors EmployeeManagement.jsx's pattern,
  // minus delete: clicking a node is view + edit only (see plan).
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [pendingSaveRow, setPendingSaveRow] = useState(null);

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

  // Bulk chart data above is deliberately lean (see fetchOrganizationHierarchy.js)
  // -- full detail for the one clicked employee is fetched on demand here,
  // only while the sidebar is open, so editing reuses the exact same
  // tableConfig.jsx field set Employee Management uses without over-fetching
  // for every node on every page load.
  const { data: employeeDetail, isLoading: employeeDetailLoading } =
    useEmployeeById(selectedEmployeeId);

  const {
    managers: allManagers,
    profiles,
    departments: allDepartments,
    nationalities,
    identificationTypes,
    employmentTypes,
    terminationReasons,
    employmentStatuses,
    workLocations,
  } = useEmployeesMetadata();

  const { updateEmployee, updating } = useEmployeeMutations();

  const columns = useMemo(
    () =>
      employeesTableConfig({
        managers: allManagers,
        profiles,
        departments: allDepartments,
        nationalities,
        identificationTypes,
        employmentTypes,
        terminationReasons,
        employmentStatuses,
        workLocations,
      }),
    [
      allManagers,
      profiles,
      allDepartments,
      nationalities,
      identificationTypes,
      employmentTypes,
      workLocations,
      terminationReasons,
      employmentStatuses,
    ],
  );

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

  function handleNodeClick(_event, node) {
    setSelectedEmployeeId(node.id);
    setSidebarOpen(true);
    setIsEditing(false);
  }

  function handleCloseSidebar() {
    setSidebarOpen(false);
    setSelectedEmployeeId(null);
    setIsEditing(false);
  }

  function handleRequestSave(data) {
    setPendingSaveRow(data);
    setSaveModalOpen(true);
  }

  async function handleConfirmSave() {
    try {
      await updateEmployee(pendingSaveRow);

      // useEmployeeMutations only invalidates ["employees"] (the paginated
      // list query) -- the chart's own bulk tree and this single-record
      // detail fetch use different query keys, so without this the chart
      // would keep showing stale data (e.g. an old manager_id/department)
      // until a manual page refresh.
      queryClient.invalidateQueries({ queryKey: ["organization_hierarchy"] });
      queryClient.invalidateQueries({
        queryKey: ["employee", selectedEmployeeId],
      });

      setSaveModalOpen(false);
      setPendingSaveRow(null);
      setIsEditing(false);
    } catch (err) {
      console.error(err);
    }
  }

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

      {/* NODE DETAIL / EDIT SIDEBAR -- view + edit only, no delete from the chart */}
      <AnimatePresence>
        {sidebarOpen && (
          <DataSidebar
            title={isEditing ? "Edit Employee" : "Employee Details"}
            icon={PencilSimpleLineIcon}
            open={sidebarOpen}
            onClose={handleCloseSidebar}
            rowData={employeeDetail || {}}
            columns={columns}
            onSave={handleRequestSave}
            saving={updating}
            isEditing={isEditing}
            onCancel={() => setIsEditing(false)}
            // View + edit only from the chart -- no delete (confirmed decision,
            // see plan). DataForm's Delete button is otherwise gated only by
            // `!creating`, not by whether onDelete is passed, so this prop is
            // required to actually hide it rather than leaving a no-op button.
            hideDelete

          >
            {employeeDetailLoading ? (
              <CardLayout style="cardLayoutFlexFull">
                <LoadingIcon />
              </CardLayout>
            ) : (
              employeeDetail?.id &&
              !isEditing && (
                <EmployeeSidebar
                  selectedRow={employeeDetail}
                  isEditing={isEditing}
                  setIsEditing={setIsEditing}
                />
              )
            )}
          </DataSidebar>
        )}
      </AnimatePresence>

      <ActionModal
        open={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        title="Save Employee"
        description="Are you sure you want to save these changes?"
        confirmText="Save"
        loading={updating}
        onConfirm={handleConfirmSave}
        modalType="save"
      />
    </section>
  );
}

export default OrganizationChart;
