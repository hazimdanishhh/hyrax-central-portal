import Select from "react-select";
import { forwardRef } from "react";

// Mirrors SelectEditor.jsx exactly, but isMulti + array in/out instead of a
// single scalar. react-select already supports isMulti natively -- this is
// the first place in this codebase it's turned on. Used for both project
// members (options = all active employees) and task assignees (options =
// that project's own working members only, via a dependent options
// function -- same pattern as asset_subcategory_id filtered by
// asset_category_id in IT assets).
const MultiSelectEditor = forwardRef(
  (
    {
      value,
      options = [],
      onChange,
      onBlur,
      required,
      placeholder = "Select...",
      isSearchable,
      readOnly,
      name,
    },
    ref,
  ) => {
    const selectedValues = Array.isArray(value) ? value : [];

    return (
      <Select
        ref={ref}
        name={name}
        onBlur={onBlur}
        unstyled
        isMulti
        className="selectContainer"
        classNamePrefix="reactSelect"
        placeholder={placeholder}
        isDisabled={readOnly}
        isSearchable={isSearchable}
        options={options}
        value={options.filter((opt) =>
          selectedValues.some((v) => String(v) === String(opt.value)),
        )}
        onChange={(selectedOptions) => {
          onChange((selectedOptions || []).map((opt) => opt.value));
        }}
        required={required}
      />
    );
  },
);

export default MultiSelectEditor;
