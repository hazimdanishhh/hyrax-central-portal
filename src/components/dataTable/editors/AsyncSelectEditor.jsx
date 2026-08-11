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
      // Optional (col.formatOptionLabel) -- react-select's own prop,
      // threaded straight through by DataForm. Lets a picker show more than
      // a plain label per option (e.g. code + city + contact, for
      // disambiguating same-named SAP customers) without needing a
      // different editor entirely.
      formatOptionLabel,
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
        formatOptionLabel={formatOptionLabel}
      />
    );
  },
);

export default AsyncSelectEditor;
