import { forwardRef } from "react";
import Select from "react-select";
import { UserCircleIcon, XIcon } from "@phosphor-icons/react";
import "./EmployeeMultiSelectEditor.scss";

/**
 * Same recipe as TaskDocumentsEditor.jsx, applied to employees: a
 * separately-rendered list of currently-selected people (avatar + name +
 * remove button) sitting above a STATELESS add-picker (its own value is
 * always [], so it never shows already-selected people as pills inside
 * itself -- selection state lives only in the external list). Replaces
 * relying on react-select's own in-dropdown multi-value pills, which
 * aren't even CSS-styled anywhere in this codebase.
 *
 * value: array of employee ids. options: [{value, label, avatarUrl?}] --
 * the same shape MultiSelectEditor.jsx already expects, with an added
 * optional avatarUrl.
 */
const EmployeeMultiSelectEditor = forwardRef(
  ({ value, onChange, options = [], placeholder = "Add people...", readOnly, name, onBlur }, ref) => {
    const selectedIds = Array.isArray(value) ? value : [];
    const selectedOptions = options.filter((opt) => selectedIds.some((v) => String(v) === String(opt.value)));
    const addableOptions = options.filter((opt) => !selectedIds.some((v) => String(v) === String(opt.value)));

    function handleAdd(selectedOptionsFromPicker) {
      const newIds = (selectedOptionsFromPicker || []).map((opt) => opt.value);
      onChange([...selectedIds, ...newIds]);
    }

    function handleRemove(id) {
      onChange(selectedIds.filter((v) => String(v) !== String(id)));
    }

    return (
      <div className="employeeMultiSelectEditor" ref={ref}>
        {selectedOptions.length > 0 && (
          <ul className="employeeMultiSelectEditorList">
            {selectedOptions.map((opt) => (
              <li key={opt.value} className="employeeMultiSelectEditorItem">
                {opt.avatarUrl ? (
                  <img src={opt.avatarUrl} alt="" className="employeeMultiSelectEditorAvatar" />
                ) : (
                  <UserCircleIcon size={20} />
                )}
                <span className="textXXS truncate employeeMultiSelectEditorName" title={opt.label}>
                  {opt.label}
                </span>
                {!readOnly && (
                  <button
                    type="button"
                    className="employeeMultiSelectEditorRemove"
                    onClick={() => handleRemove(opt.value)}
                    title="Remove"
                  >
                    <XIcon size={12} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {!readOnly && addableOptions.length > 0 && (
          <Select
            name={name}
            onBlur={onBlur}
            unstyled
            isMulti
            className="selectContainer"
            classNamePrefix="reactSelect"
            placeholder={placeholder}
            options={addableOptions}
            value={[]}
            onChange={handleAdd}
          />
        )}
      </div>
    );
  },
);

EmployeeMultiSelectEditor.displayName = "EmployeeMultiSelectEditor";
export default EmployeeMultiSelectEditor;
