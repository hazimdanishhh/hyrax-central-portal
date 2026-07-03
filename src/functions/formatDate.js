/**
 * Shared date/time formatters (en-MY).
 *
 * These were previously copy-pasted, byte-for-byte, across ~9 fetch/normalize
 * services in src/features/**. Import from here instead of re-declaring them.
 * All three return null for empty/falsy input so they're safe to map over rows.
 */

export function formatDateTime(value) {
  if (!value) return null;

  return new Date(value).toLocaleString("en-MY", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function formatDate(value) {
  if (!value) return null;

  return new Date(value).toLocaleDateString("en-MY", {
    dateStyle: "medium",
  });
}

export function formatTime(value) {
  if (!value) return null;

  return new Date(value).toLocaleTimeString("en-MY", {
    timeStyle: "short",
  });
}
