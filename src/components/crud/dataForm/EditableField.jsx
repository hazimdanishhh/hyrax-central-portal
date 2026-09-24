import { Controller } from "react-hook-form";
import { editors } from "../../dataTable/editors/Editors";
import { isFilled } from "@/features/_shared/isFilled";

/**
 * One column's editor, wired to react-hook-form -- extracted out of
 * DataForm.jsx so the row-level inline table editor (EditableTableRow.jsx)
 * can reuse the exact same validation/editor-prop wiring instead of a
 * second, thinner implementation (the old per-cell table editor only ever
 * passed {value, options, onChange, onBlur}, so e.g. an asyncSelect column
 * never had its `loadOptions` wired and silently never worked inline).
 *
 * `hideLabel` skips the label + required-asterisk wrapper DataForm wants
 * (fields are grouped under a section header there) -- the table row editor
 * just wants the bare editor, since the column header already is the label.
 */
export default function EditableField({
  col,
  control,
  currentFormValues,
  rowData,
  setValue,
  hideLabel = false,
}) {
  const Editor = editors[col.editor] ?? editors.text;

  // Generates a dynamic React key based on dependencies -- unique key forces
  // React to destroy and remount the field if a dependency changes, wiping
  // e.g. an AsyncSelect's stale cached options.
  const dependencyString = col.dependsOn
    ? col.dependsOn
        .map((dep) => {
          const val = currentFormValues[dep];
          return typeof val === "object" ? val?.value : val;
        })
        .join("-")
    : "static";
  const componentKey = `${col.key}-${dependencyString}`;

  // `required` may be a FUNCTION of the form's live values, not just a boolean
  // -- the same treatment `options` already gets below.
  //
  // This is what lets a requirement depend on a sibling field chosen in the
  // same form. The motivating case is attendance evidence: whether a photo is
  // mandatory is a property of the attendance TYPE the user just picked
  // (attendance_types.requires_photo), so it cannot be known when the column
  // config is built -- the config is built by the page, which has no access to
  // the form's internal state.
  //
  // The alternative was threading a `selectedTypeId` through every caller and
  // rebuilding the config on each keystroke; attendanceActivityConfig already
  // accepts such a parameter and no caller ever passed it, which is precisely
  // why `selectedType?.requires_location` there had silently never worked.
  //
  // Resolved once per render and used by all three consumers below (the
  // validator, the editor's own `required` prop, and the label asterisk) so
  // they cannot disagree about whether the field is mandatory right now.
  const isRequired =
    typeof col.required === "function"
      ? col.required(currentFormValues, rowData)
      : col.required;

  const controller = (
    <Controller
      name={col.key}
      control={control}
      rules={{
        // NOT RHF's native `required: col.required` -- RHF special-cases
        // boolean values and treats `false` as "empty", failing required for
        // any field whose valid answers include a deliberate `false` (e.g. a
        // tri-state select like needs_it_asset: true/false/null, where only
        // null/not-yet-decided should ever fail required). isFilled is RHF's
        // own required semantics minus that boolean special case.
        validate: {
          required: (value) =>
            !isRequired || isFilled(value) || `${col.label} is required`,
          // Cross-field ordering checks (e.g. Join Date before Confirmation
          // Date) -- `rowData` covers a comparison against a value that
          // isn't even part of this form's own columns; `formValues` covers
          // a comparison against a sibling field's live value within this
          // same form. Returning a string (RHF's own convention) becomes
          // that field's error message.
          ...(col.validate && {
            custom: (value) =>
              col.validate(value, {
                rowData,
                formValues: currentFormValues,
              }),
          }),
        },
      }}
      render={({ field }) => (
        <Editor
          {...field}
          key={componentKey} // Physically remounts to wipe AsyncSelect cache
          loadOptions={
            col.loadOptions
              ? (search) => col.loadOptions(search, currentFormValues)
              : undefined
          }
          options={
            typeof col.options === "function"
              ? col.options(currentFormValues)
              : col.options
          }
          // The date to re-attach for a "time"-editor column (see
          // TimeEditor.jsx) -- optional; only meaningful to that editor,
          // ignored (harmless) by every other one.
          //
          // `currentFormValues` is passed as a second argument because on a
          // CREATE form `rowData` is `{}` -- there is no existing row to read
          // an anchor date off, and the date being anchored to is a sibling
          // field the user is filling in right now. Without it,
          // getReferenceDate returned undefined, combineMYTDateAndTime()
          // short-circuited to null, and a required time column could never
          // be satisfied: the form was unsubmittable. Columns that only ever
          // edit an existing row ignore the second argument harmlessly.
          referenceDate={
            col.getReferenceDate
              ? col.getReferenceDate(rowData, currentFormValues)
              : undefined
          }
          // Wrap onChange to handle "clears" logic
          onChange={(val) => {
            field.onChange(val); // Standard RHF update
            if (col.clears) {
              col.clears.forEach((clearKey) => setValue(clearKey, null));
            }
          }}
          required={isRequired}
          isSearchable={col.isSearchable}
          readOnly={!col.editable}
          min={col.min}
          max={col.max}
          step={col.step}
          isClearable={col.isClearable}
          cacheOptions={col.cacheOptions}
          formatOptionLabel={col.formatOptionLabel}
          allowReplace={col.allowReplace}
          // Only meaningful to the drivePicker editor (GoogleDriveEditor) --
          // restricts its picker to folders/Shared Drives instead of files.
          // Ignored (harmless) by every other editor.
          selectFolders={col.selectFolders}
        />
      )}
    />
  );

  if (hideLabel) return controller;

  return (
    <div className={`dataSidebarField ${col.half ? "half" : ""}`}>
      <label className={`textBold textXXS ${isRequired ? "required" : ""}`}>
        {col.label}
        <span className="dataSidebarRequired">{isRequired && "*"}</span>
      </label>
      {controller}
    </div>
  );
}
