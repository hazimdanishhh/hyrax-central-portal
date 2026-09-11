import {
  toMYTTimeInputValue,
  combineMYTDateAndTime,
} from "@/functions/formatDate";

/**
 * Time-only editor for a timestamptz column that should keep its existing
 * calendar date -- e.g. correcting a clock-in/out TIME without letting the
 * DATE drift. `referenceDate` (optional, passed by DataForm.jsx from a
 * column's `getReferenceDate(rowData)`) is the date to re-attach; when
 * omitted, falls back to the field's own current `value`'s date, so this
 * also works standalone on a table with no separate date column to anchor
 * to.
 */
export default function TimeEditor({
  value,
  onChange,
  onBlur,
  required,
  readOnly,
  referenceDate,
}) {
  function handleChange(newValue) {
    if (!newValue) {
      onChange(null);
      return;
    }

    onChange(combineMYTDateAndTime(referenceDate ?? value, newValue));
  }

  return (
    <div className="editorContainer">
      <input
        type="time"
        value={toMYTTimeInputValue(value)}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={onBlur}
        required={required}
        readOnly={readOnly}
      />
    </div>
  );
}
