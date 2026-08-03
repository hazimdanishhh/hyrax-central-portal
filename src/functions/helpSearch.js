// src/functions/helpSearch.js

// Plain substring match across title/summary/body/tags -- not fuzzy search.
// Content volume is expected to stay in the dozens (internal SME portal),
// so this needs no index, debounce, or search library.
export function filterHelpItems(items, query) {
  const q = query.trim().toLowerCase();
  if (!q) return items;

  return items.filter((item) =>
    [item.title, item.summary, item.body, ...(item.tags ?? [])]
      .filter(Boolean)
      .some((field) => field.toLowerCase().includes(q)),
  );
}

// Cross-category search results link into the tab that owns each item's
// type, since content isn't deep-linked to a specific in-tab anchor yet.
const TYPE_TO_TAB_PATH = {
  faq: "faq",
  guide: "guides",
  link: "guides",
  glossary: "glossary",
  contact: "contact",
};

export function getHelpTabPathForType(type) {
  return TYPE_TO_TAB_PATH[type] ?? "faq";
}
