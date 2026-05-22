import AsyncSelect from "react-select/async";
import { forwardRef } from "react";

const AsyncSelectEditor = forwardRef(
  (
    {
      value,
      onChange,
      loadOptions,
      placeholder = "Search...",
      isClearable = true,
      readOnly,
      cacheOptions = true,
      name,
      onBlur,
    },
    ref, // <-- ref is passed as the second argument inside the forwardRef callback
  ) => {
    return (
      <AsyncSelect
        ref={ref}
        name={name}
        onBlur={onBlur}
        unstyled
        className="selectContainer"
        classNamePrefix="reactSelect"
        cacheOptions={cacheOptions}
        defaultOptions
        loadOptions={loadOptions}
        placeholder={placeholder}
        isClearable={isClearable}
        value={value}
        onChange={onChange}
        isDisabled={readOnly}
      />
    );
  },
);

export default AsyncSelectEditor;
