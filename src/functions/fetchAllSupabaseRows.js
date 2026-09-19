// Pages through a Supabase query in chunks via .range() until a page returns
// fewer rows than PAGE_SIZE, concatenating every page. Found necessary
// 2026-09: a "resolve every matching id" helper doing a single unbounded
// .select().eq() silently truncated at a server-side default row cap
// (confirmed live -- Journal Entries' accountCode drill-through for a
// single high-volume account had 1,946 real matching sap_gl_journal_lines
// rows spanning to 2026, but the unbounded fetch only ever surfaced the
// oldest ~1000, collapsing to 864 distinct trans_ids after dedup and making
// the drill-through look like it stopped in 2021). Correct regardless of
// the server's actual configured row-limit value, since it never assumes
// one -- it just keeps paging until a short page proves there's nothing
// left.
//
// `buildQuery` must return a FRESH query builder each call (so .range() can
// be applied to it) and must already include its own stable, deterministic
// `.order(...)` -- .range()-based pagination without one can skip or
// duplicate rows across page boundaries, since Postgres doesn't guarantee
// row order otherwise.
const PAGE_SIZE = 1000;

export async function fetchAllSupabaseRows(buildQuery) {
  let allRows = [];
  let page = 0;

  while (true) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await buildQuery().range(from, to);

    if (error) throw error;

    allRows = allRows.concat(data || []);

    if (!data || data.length < PAGE_SIZE) break;
    page++;
  }

  return allRows;
}
