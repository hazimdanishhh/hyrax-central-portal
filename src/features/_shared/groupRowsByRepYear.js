// features/_shared/groupRowsByRepYear.js
//
// Groups a flat array of "one row per rep per month" quota rows into
// {repKey, year} tiles for a master grouped-list view. Shared by Sales
// Targets (lead_owner_id/target_month, uuid rep key) and Sales Budgets
// (sales_rep_code/budget_month, bigint rep key) -- identity-agnostic by
// construction via the getRepKey/getRepLabel/getMonthDate/getRevenue
// callbacks, so it never assumes uuid vs. bigint.
//
// Grouping is done CLIENT-SIDE, not via a grouping RPC: this is a small
// internal tool with a modest rep count and no dedicated backend team, and
// this repo's SQL is hand-run (not migration-managed), so every new RPC is
// a manual, easy-to-forget Supabase Studio step. Revisit only if rep/year
// cardinality grows large -- swapping this for a server-grouped RPC later
// is a contained change, isolated from routing/drill-in work.
export function groupRowsByRepYear({
  rows,
  getRepKey,
  getRepLabel,
  getMonthDate,
  getRevenue,
}) {
  const groups = new Map();

  (rows || []).forEach((row) => {
    const repKey = getRepKey(row);
    // getUTCFullYear, not getFullYear -- target_month/budget_month are
    // plain date-only strings, which parse as UTC midnight; local getters
    // would roll back a day for any viewer in a negative UTC offset.
    const year = new Date(getMonthDate(row)).getUTCFullYear();
    const groupKey = `${repKey}::${year}`;

    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        repKey,
        repLabel: getRepLabel(row),
        year,
        filledMonths: 0,
        totalRevenue: 0,
      });
    }

    const group = groups.get(groupKey);
    group.filledMonths += 1;
    group.totalRevenue += Number(getRevenue(row) || 0);
  });

  return Array.from(groups.values()).sort(
    (a, b) => a.repLabel.localeCompare(b.repLabel) || b.year - a.year,
  );
}
