/**
 * URL <-> TanStack SortingState conversion for multi-column sort, using the
 * same "col.asc,col2.desc" format PostgREST itself uses for `?order=` --
 * see usePaginatedQuery.js's `sort` param and each service function's
 * chained `.order()` calls.
 */
export function parseSortParam(raw) {
  if (!raw) return null;

  const parsed = raw
    .split(",")
    .map((part) => {
      const [id, dir] = part.split(".");
      return id ? { id, desc: dir === "desc" } : null;
    })
    .filter(Boolean);

  return parsed.length ? parsed : null;
}

export function serializeSorting(sorting) {
  return sorting.map(({ id, desc }) => `${id}.${desc ? "desc" : "asc"}`).join(",");
}
