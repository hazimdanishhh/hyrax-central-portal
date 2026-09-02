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

/**
 * "2h ago" / "3d ago" style relative time -- for staleness displays (e.g.
 * pipeline last-synced) where the exact timestamp matters less than how
 * long ago it was.
 */
export function formatRelativeTime(value) {
  if (!value) return null;

  const diffMinutes = Math.round(
    (Date.now() - new Date(value).getTime()) / 60000,
  );

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}
