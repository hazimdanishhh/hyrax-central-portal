import Select from "react-select";
import { forwardRef } from "react";

const SelectEditor = forwardRef(
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
      isClearable = true,
      name,
    },
    ref,
  ) => {
    return (
      <Select
        ref={ref}
        name={name}
        onBlur={onBlur}
        unstyled
        className="selectContainer"
        classNamePrefix="reactSelect"
        placeholder={placeholder}
        isClearable={isClearable}
        isDisabled={readOnly} // <-- react-select uses isDisabled
        isSearchable={isSearchable}
        options={options}
        // 1. Find the matching option object using string comparison
        value={
          options.find((opt) => String(opt.value) === String(value)) || null
        }
        // 2. Extract the raw value to send back to the parent component
        onChange={(selectedOption) => {
          onChange(selectedOption ? selectedOption.value : "");
        }}
        required={required}
      />
    );
  },
);

export default SelectEditor;
