import AsyncSelect from "react-select/async";

export default function AsyncSelectEditor({
  value,
  onChange,
  loadOptions,
  placeholder = "Search...",
  isClearable = true,
  readOnly,
}) {
  async function handleLoadOptions(inputValue) {
    return await loadOptions(inputValue);
  }

  return (
    <AsyncSelect
      unstyled
      className="selectContainer"
      classNamePrefix="reactSelect"
      cacheOptions
      defaultOptions
      loadOptions={handleLoadOptions}
      placeholder={placeholder}
      isClearable={isClearable}
      value={value}
      onChange={onChange}
      isDisabled={readOnly}
    />
  );
}
