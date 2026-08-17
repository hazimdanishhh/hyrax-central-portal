import { useState } from "react";
import CardLayout from "../../../../../../components/cardLayout/CardLayout";
import Button from "../../../../../../components/buttons/button/Button";
import { LinkIcon, LinkBreakIcon } from "@phosphor-icons/react";
import {
  useLinkedEmployee,
  useUnlinkedEmployees,
  useLinkProfileToEmployee,
} from "../../../../../../features/superadmin/users/private/hooks/useEmployeeLink";

// Manual profile <-> employee linking, a superadmin convenience separate
// from the generic column-edit save flow above it in DataSidebar -- writes
// to employees.profile_id (a different table/entity than this form
// otherwise edits), via the link_profile_to_employee RPC. No department/
// role side effects -- see that RPC's own header comment for why.
export default function UserEmployeeLink({ selectedRow }) {
  const profileId = selectedRow?.id;
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");

  const { data: linkedEmployee, isLoading: linkedLoading } =
    useLinkedEmployee(profileId);
  const { employees: unlinkedEmployees, isLoading: unlinkedLoading } =
    useUnlinkedEmployees();
  const { linkProfileToEmployee, linking } = useLinkProfileToEmployee();

  if (!profileId) return null;

  async function handleLink() {
    if (!selectedEmployeeId) return;
    await linkProfileToEmployee({
      // employees.id is uuid, not numeric -- Number() on a uuid string
      // evaluates to NaN, which then serializes to JSON `null`, so this
      // previously sent p_employee_id: null on every "Link" click
      // regardless of which employee was selected.
      profileId,
      employeeId: selectedEmployeeId,
    });
    setSelectedEmployeeId("");
  }

  async function handleUnlink() {
    await linkProfileToEmployee({ profileId, employeeId: null });
  }

  return (
    <CardLayout style="cardPadding cardGapSmall">
      <p className="textBold textXS">Linked Employee</p>

      {linkedLoading ? (
        <p className="textLight textXXS">Checking link status...</p>
      ) : linkedEmployee ? (
        <div className="cardLayoutFlex cardGapSmall">
          <p className="textXS">
            {linkedEmployee.full_name}{" "}
            <span className="textLight textXXS">
              ({linkedEmployee.employee_id})
            </span>
          </p>
          <Button
            name="Unlink"
            icon={LinkBreakIcon}
            style="button buttonType4 rejection textXXS"
            size={14}
            disabled={linking}
            onClick={handleUnlink}
          />
        </div>
      ) : (
        <div className="cardLayoutFlex cardGapSmall">
          <select
            value={selectedEmployeeId}
            onChange={(e) => setSelectedEmployeeId(e.target.value)}
            disabled={unlinkedLoading || linking}
          >
            <option value="">
              {unlinkedLoading ? "Loading employees..." : "Select an employee"}
            </option>
            {unlinkedEmployees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.full_name} ({emp.employee_id})
              </option>
            ))}
          </select>
          <Button
            name="Link"
            icon={LinkIcon}
            style="button buttonType5 approval textXXS"
            size={14}
            disabled={!selectedEmployeeId || linking}
            onClick={handleLink}
          />
        </div>
      )}
    </CardLayout>
  );
}
