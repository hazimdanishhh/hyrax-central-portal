// functions/attendanceEvidenceRules.js
//
// One place that answers "does this attendance activity need a photo / notes?"
//
// THE ANSWER LIVES IN THE DATABASE, NOT IN THESE FORMS.
// attendance_types.requires_photo / requires_notes are real, seeded columns.
// They were already being fetched (useAttendanceActivityMutations.js selects
// them) and read by nothing: requires_photo sat commented out in
// attendanceActivityApprovalConfig.js, and no server-side check existed at all.
//
// WHY THIS FILE EXISTS. Evidence capture had drifted to opposite extremes
// across the surfaces that create an activity -- present on HR's Add Activity
// form and the timeline EDIT form, absent from the sidebar's own Add Activity
// and from the backfill wizard, and commented out entirely on the employee's
// live clock-in. So a photo was collected where it proves least (HR editing a
// record after the fact) and never where it proves most (the live capture
// moment, and self-asserted rows that land Pending for a manager to approve
// with nothing to look at).
//
// Every form now derives the rule from the selected type through here, so
// adding a surface cannot reintroduce the drift, and changing the policy is a
// data edit rather than a code change in five files.
//
// PAIRED WITH A SERVER-SIDE CHECK, deliberately. This is a UX affordance; it
// is not the enforcement. See create_attendance_backfill_rpc.sql, whose own
// comment on the equivalent adjustment-reason rule says why:
//
//     requires_notes is enforced here, not only in the form: the client-side
//     column config can express "always required" but not "required only when
//     reason = other".

/**
 * Resolve the attendance type row the form is currently pointed at.
 *
 * Tolerates the two shapes a select can hold: a bare id, or react-select's
 * `{ value, label }` object. normalizeFields unwraps the latter on save, but
 * these predicates run while the form is still open, before that happens.
 *
 * Compares loosely (`==`) on purpose -- attendance_types.id is a bigint, which
 * arrives from PostgREST as a number, while a value round-tripped through a
 * select or a URL param is a string. Strict equality here silently resolves to
 * `undefined` and every requirement quietly evaluates to false, which is the
 * failure mode this whole file exists to end.
 */
function resolveSelectedType(attendanceTypes, rawValue) {
  if (rawValue === null || rawValue === undefined) return undefined;

  const id =
    typeof rawValue === "object" && rawValue !== null && "value" in rawValue
      ? rawValue.value
      : rawValue;

  // Loose comparison on purpose (see the doc comment above) -- String() both
  // sides rather than `==`, so the intent survives anyone later turning on
  // eqeqeq and "fixing" it into a strict compare that silently never matches.
  return (attendanceTypes || []).find((t) => String(t.id) === String(id));
}

/**
 * Build a `required` predicate for a column config.
 *
 * Returns a FUNCTION, which EditableField resolves against the form's live
 * values on every render -- so the asterisk, the editor's own required prop
 * and the validator all update the moment the user picks a different type.
 *
 * @param attendanceTypes the full list, as loaded by the page
 * @param flag            "requires_photo" | "requires_notes"
 * @param typeKey         the form field holding the type id; the backfill
 *                        wizard uses a different name from the CRUD forms
 */
export function evidenceRequired(
  attendanceTypes,
  flag,
  typeKey = "attendance_type_id",
) {
  return (formValues) => {
    const selected = resolveSelectedType(attendanceTypes, formValues?.[typeKey]);

    // Unknown type -> not required. The type field is itself required, so the
    // form cannot be submitted in this state anyway, and demanding a photo
    // before the user has said what they are doing reads as a broken form.
    return Boolean(selected?.[flag]);
  };
}

/**
 * Human-readable hint for the currently selected type, or null.
 *
 * Kept next to the predicate so the wording cannot drift from the rule -- a
 * form that demands a photo without saying why is the thing people work around.
 */
export function evidenceHint(attendanceTypes, formValues, typeKey = "attendance_type_id") {
  const selected = resolveSelectedType(attendanceTypes, formValues?.[typeKey]);
  if (!selected) return null;

  const needs = [
    selected.requires_photo && "a photo",
    selected.requires_notes && "notes",
  ].filter(Boolean);

  if (needs.length === 0) return null;

  return `${selected.name} requires ${needs.join(" and ")}.`;
}
