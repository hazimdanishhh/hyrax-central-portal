import { Handle, Position } from "@xyflow/react";
import { TreeStructureIcon, UserCircleIcon } from "@phosphor-icons/react";
import "./EmployeeNode.scss";

function EmployeeNode({ data }) {
  const { employee, isDimmed, isCrossDepartment, isCurrentUser } = data;

  return (
    <div
      className={`employeeNode${isDimmed ? " employeeNodeDimmed" : ""}${isCurrentUser ? " employeeNodeCurrentUser" : ""}`}
    >
      <Handle type="target" position={Position.Top} />

      <div className="employeeNodePhoto">
        <img
          src={employee.profile?.avatar_url || "/profilePhoto/default.webp"}
          alt={employee.full_name}
        />
      </div>

      <div className="employeeNodeDetails">
        <p className="textBold textXS employeeNodeName">
          {employee.full_name}
          {isCurrentUser && (
            <span className="employeeNodeYouFlag" title="This is you">
              <UserCircleIcon size={12} weight="fill" />
            </span>
          )}
        </p>
        <p className="textLight textXXS employeeNodePosition">
          {employee.position || "—"}
        </p>
        <p className="employeeNodeDeptBadge textXXXS">
          {employee.department?.sub || employee.department?.name || "—"}
          {isCrossDepartment && (
            <span
              className="employeeNodeCrossDeptFlag"
              title="Reports to a manager in a different department"
            >
              <TreeStructureIcon size={10} weight="bold" />
            </span>
          )}
        </p>
      </div>

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

export default EmployeeNode;
