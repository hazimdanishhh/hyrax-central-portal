import Select from "react-select";

export default function SelectEditor({
  value,
  options = [],
  onChange,
  onBlur,
  required,
  placeholder = "Select...",
  isSearchable,
  readOnly,
}) {
  return (
    // <select
    //   value={value ?? ""}
    //   onChange={(e) => onChange(e.target.value)}
    //   onBlur={onBlur}
    //   required={required}
    // >
    //   <option value="" />

    //   {options.map((opt) => (
    //     <option key={opt.value} value={opt.value}>
    //       {opt.label}
    //     </option>
    //   ))}
    // </select>

    <Select
      unstyled
      className="selectContainer"
      classNamePrefix="reactSelect"
      placeholder={placeholder}
      isClearable={readOnly}
      readOnly={readOnly}
      isSearchable={isSearchable}
      options={options}
      // 1. Find the matching option object using string comparison
      value={options.find((opt) => String(opt.value) === String(value)) || null}
      // 2. Extract the raw value to send back to the parent component
      onChange={(selectedOption) => {
        onChange(selectedOption ? selectedOption.value : "");
      }}
      onBlur={onBlur}
      required={required}
    />
  );
}
