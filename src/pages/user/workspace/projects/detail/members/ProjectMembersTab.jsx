import { useState } from "react";
import { useParams } from "react-router";
import { PlusIcon, TrashSimpleIcon, UserCircleIcon } from "@phosphor-icons/react";
import { AnimatePresence } from "framer-motion";
import CardLayout from "../../../../../../components/cardLayout/CardLayout";
import LoadingIcon from "../../../../../../components/loadingIcon/LoadingIcon";
import NoResult from "../../../../../../components/crud/noResult/NoResult";
import PageHeader from "../../../../../../components/crud/pageHeader/PageHeader";
import Button from "../../../../../../components/buttons/button/Button";
import StatusBox from "../../../../../../components/status/statusBox/StatusBox";
import EmployeeImage from "../../../../../../components/employees/employeeImage/EmployeeImage";
import DataSidebar from "../../../../../../components/dataSidebar/DataSidebar";
import ActionModal from "../../../../../../components/modals/actionModal/ActionModal";
import Select from "react-select";
import { useProject } from "../../../../../../features/workspace/projects/private/hooks/useProject";
import { useProjectPermissions } from "../../../../../../features/workspace/projects/private/hooks/useProjectPermissions";
import useProjectMemberMutations from "../../../../../../features/workspace/projects/private/hooks/useProjectMemberMutations";
import useAllEmployeesPublic from "../../../../../../features/hr/employees/public/hooks/useAllEmployeesPublic";
import { ASSIGNABLE_PROJECT_ROLES, PROJECT_ROLE_LABEL } from "../../../../../../features/workspace/projects/private/projectRoleMeta";
import "./ProjectMembersTab.scss";

/**
 * Member roster -- each row is a read-only summary (avatar+name -- still a
 * real link to the profile via EmployeeImage's own behavior, department,
 * role) that opens a sidebar with the actual edit controls (role picker,
 * remove) on click. This deliberately splits two click targets that used
 * to be conflated: EmployeeImage's own Link (view this person's profile,
 * unrelated to project membership) vs. the row itself (manage their
 * membership) -- clicking the avatar still navigates away as normal
 * everywhere else in this app; clicking elsewhere on the row opens the
 * project-specific sidebar instead.
 */
export default function ProjectMembersTab() {
  const { projectId } = useParams();
  const { members, isLoading, error } = useProject(projectId);
  const permissions = useProjectPermissions(members);
  const { syncMembers, removeMember, updateMemberRole, syncing, removing, updatingRole } = useProjectMemberMutations(projectId);
  const { data: allEmployees = [] } = useAllEmployeesPublic();

  const [addingOpen, setAddingOpen] = useState(false);
  const [selectedNewMembers, setSelectedNewMembers] = useState([]);
  const [selectedNewRole, setSelectedNewRole] = useState(ASSIGNABLE_PROJECT_ROLES[1]); // default: member

  function handleCloseAdd() {
    setAddingOpen(false);
    setSelectedNewMembers([]);
    setSelectedNewRole(ASSIGNABLE_PROJECT_ROLES[1]);
  }

  const [selectedMember, setSelectedMember] = useState(null);
  const [pendingRemove, setPendingRemove] = useState(null);
  const [hoveredEmployeeId, setHoveredEmployeeId] = useState(null);

  const currentMemberIds = new Set(members.map((m) => m.employee_id));
  const addableEmployeeOptions = allEmployees.filter((e) => !currentMemberIds.has(e.id)).map((e) => ({ label: e.full_name, value: e.id }));

  async function handleAddMembers() {
    if (!selectedNewMembers.length) return;

    // syncMembers replaces the FULL non-owner roster, so existing
    // non-owner members must be included unchanged alongside the new ones.
    const existingAssignments = members.filter((m) => m.role !== "owner").map((m) => ({ employeeId: m.employee_id, role: m.role }));
    const newAssignments = selectedNewMembers.map((opt) => ({ employeeId: opt.value, role: selectedNewRole.value }));

    await syncMembers([...existingAssignments, ...newAssignments]);
    handleCloseAdd();
  }

  async function handleRoleChange(m, newRole) {
    await updateMemberRole({ employeeId: m.employee_id, role: newRole });
    setSelectedMember((prev) => (prev && prev.employee_id === m.employee_id ? { ...prev, role: newRole } : prev));
  }

  function handleRequestRemove(m) {
    setPendingRemove(m);
  }

  async function handleConfirmRemove() {
    if (!pendingRemove) return;
    await removeMember(pendingRemove.employee_id);
    setPendingRemove(null);
    setSelectedMember(null);
  }

  if (isLoading) {
    return (
      <CardLayout style="cardLayoutFlexFull">
        <LoadingIcon />
      </CardLayout>
    );
  }

  if (error) {
    return <NoResult title="Error loading members" />;
  }

  return (
    <>
      {permissions.isElevated && (
        <PageHeader>
          <Button name="Add Members" icon={PlusIcon} style="button buttonType5 approval textXS" size={16} onClick={() => setAddingOpen(true)} />
        </PageHeader>
      )}

      <CardLayout style="cardLayout1 cardPaddingSmall cardGapSmall">
        {members.map((m) => (
          <div key={m.employee_id} className="generalCard cardPaddingSmall projectMemberRow" onClick={() => setSelectedMember(m)}>
            <EmployeeImage
              employee={m.employee}
              displayName
              showName={hoveredEmployeeId === m.employee_id}
              setShowName={(show) => setHoveredEmployeeId(show ? m.employee_id : null)}
            />

            {m.employee?.department && <StatusBox status={m.employee.department.name} type="grey" />}

            <StatusBox status={m.role === "owner" ? "Owner" : PROJECT_ROLE_LABEL[m.role]} type={m.role === "owner" ? "blue" : "grey"} />
          </div>
        ))}
      </CardLayout>

      {/* ADD MEMBERS SIDEBAR */}
      <AnimatePresence>
        {addingOpen && (
          <DataSidebar title="Add Members" icon={PlusIcon} open={addingOpen} onClose={handleCloseAdd} isEditing={false} hideDelete>
            <div className="projectMembersAddPanel">
              <Select
                unstyled
                isMulti
                className="selectContainer"
                classNamePrefix="reactSelect"
                placeholder="Select employees to add..."
                options={addableEmployeeOptions}
                value={selectedNewMembers}
                onChange={setSelectedNewMembers}
              />
              <Select
                unstyled
                className="selectContainer"
                classNamePrefix="reactSelect"
                placeholder="Role..."
                options={ASSIGNABLE_PROJECT_ROLES}
                value={selectedNewRole}
                onChange={setSelectedNewRole}
              />
              <Button
                name="Add"
                icon={PlusIcon}
                style="button buttonType5 approval textXS"
                size={16}
                disabled={!selectedNewMembers.length || syncing}
                onClick={handleAddMembers}
              />
            </div>
          </DataSidebar>
        )}
      </AnimatePresence>

      {/* MEMBER DETAIL / EDIT SIDEBAR */}
      <AnimatePresence>
        {selectedMember && (
          <DataSidebar
            title={selectedMember.employee?.full_name || "Member"}
            icon={UserCircleIcon}
            open={!!selectedMember}
            onClose={() => setSelectedMember(null)}
            isEditing={false}
            hideDelete
          >
            <div className="projectMemberDetailPanel">
              <EmployeeImage employee={selectedMember.employee} displayName showName setShowName={() => {}} />

              {selectedMember.employee?.department && <StatusBox status={selectedMember.employee.department.name} type="grey" />}

              {selectedMember.role === "owner" ? (
                <StatusBox status="Owner" type="blue" />
              ) : permissions.isElevated ? (
                <Select
                  unstyled
                  className="selectContainer projectMemberRoleSelect"
                  classNamePrefix="reactSelect"
                  options={ASSIGNABLE_PROJECT_ROLES}
                  value={ASSIGNABLE_PROJECT_ROLES.find((r) => r.value === selectedMember.role)}
                  isDisabled={updatingRole}
                  onChange={(opt) => handleRoleChange(selectedMember, opt.value)}
                />
              ) : (
                <StatusBox status={PROJECT_ROLE_LABEL[selectedMember.role]} type="grey" />
              )}

              {permissions.isElevated && selectedMember.role !== "owner" && (
                <Button
                  name="Remove from Project"
                  icon={TrashSimpleIcon}
                  style="button buttonType5 rejection textXS"
                  size={16}
                  disabled={removing}
                  onClick={() => handleRequestRemove(selectedMember)}
                />
              )}
            </div>
          </DataSidebar>
        )}
      </AnimatePresence>

      <ActionModal
        open={!!pendingRemove}
        onClose={() => setPendingRemove(null)}
        title="Remove Member"
        description={`Are you sure you want to remove ${pendingRemove?.employee?.full_name || "this member"} from the project?`}
        confirmText="Remove"
        loading={removing}
        onConfirm={handleConfirmRemove}
        modalType="delete"
      />
    </>
  );
}
