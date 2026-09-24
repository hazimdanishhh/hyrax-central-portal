import { uploadAttendancePhoto } from "./uploadAttendancePhoto";

/**
 * Resolve a staged attendance photo into stored values, ready to send to
 * PostgREST.
 *
 * ImageUploadEditor stages a raw `File` on `photo_url` (it calls
 * `onChange(file)` directly). That File has to be uploaded and swapped for its
 * URL/path BEFORE the row write -- and nothing downstream will do it for you:
 * `normalizeFields` doesn't recognise a File (it only unwraps objects carrying
 * a `value` key), so an un-uploaded File passes straight through and PostgREST
 * serialises it to the string `"{}"`.
 *
 * THAT IS NOT HYPOTHETICAL. It is exactly how the one photo-bearing activity in
 * the database ended up with `photo_url = '{}'` and an empty `photo_path`:
 * AttendanceTimelineCard's edit form had no upload step, while
 * AttendanceManagement's add/edit form had one inline. Two save paths, one of
 * them missing a step.
 *
 * This exists as a shared helper rather than a second copy of those nine lines
 * precisely because two copies drifting apart is what caused the bug. Any new
 * save path that can carry a photo must call this.
 *
 * Returns a NEW payload object; does not mutate the caller's. A no-op (returns
 * the payload unchanged) when `photo_url` is anything other than a File --
 * an existing URL string, null, or absent -- so it is safe to call
 * unconditionally on every save, which is the point.
 *
 * `photo_path` is stored alongside the URL deliberately: it is the only handle
 * on the underlying storage object, so without it an orphaned upload can never
 * be cleaned up (see the unused src/services/storage/deleteAttendancePhoto.js).
 */
/**
 * Duck-typed rather than `instanceof File`.
 *
 * `instanceof` compares against the constructor of the CURRENT realm, so a
 * File created in a different one -- an iframe, a portal, or a module graph
 * Vite has hot-swapped mid-session -- fails the check while being a perfectly
 * good File. That produced a real bug: AttendanceManagement's inline
 * `instanceof File` worked, the identical check in the timeline card's path
 * did not, and the File sailed through to PostgREST as "{}".
 *
 * Testing for the shape we actually use (a name, a size, and a readable body)
 * is both broader and more honest about the requirement.
 */
function isFileLike(value) {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof value.name === "string" &&
    typeof value.size === "number" &&
    typeof value.arrayBuffer === "function"
  );
}

export async function applyAttendancePhotoUpload(payload, employeeId) {
  const staged = payload?.photo_url;

  if (isFileLike(staged)) {
    const uploaded = await uploadAttendancePhoto(staged, employeeId);

    return {
      ...payload,
      photo_url: uploaded.url,
      photo_path: uploaded.path,
    };
  }

  // BACKSTOP. If photo_url is still a non-string object here, something
  // staged a value this helper does not understand, and letting it continue
  // means PostgREST will serialize it to the string "{}" -- silently
  // destroying the column, which is exactly the bug that produced the one
  // corrupted row in the database.
  //
  // Throwing is the right call over quietly dropping the field: the caller
  // surfaces it, the user keeps their staged photo and can retry, and the
  // column is left untouched. A silent drop would look like success.
  if (staged !== null && staged !== undefined && typeof staged !== "string") {
    throw new Error(
      "The selected photo could not be read for upload. Please re-take it and try again.",
    );
  }

  return payload;
}
