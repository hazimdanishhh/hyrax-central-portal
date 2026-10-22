// functions/navPaths.js
// One definition of "where does this nav link go" and "is it active", shared
// by SideNav, MobileNav (both via SideNavLink) and BottomTabBar, so the three
// can never disagree about which link is lit.

const BASE_PATH = "/app";

/**
 * The URL for a nav link's `path` from sideNavLinkData.js. The dashboard's
 * path is "" and must resolve to "/app", not "/app/": the router serves both,
 * but only one of them can equal location.pathname.
 */
export function navTo(path) {
  return path ? `${BASE_PATH}/${path}` : BASE_PATH;
}

/**
 * True when `pathname` is on the link's page or anywhere under it.
 *
 * The dashboard ("" -> /app) matches EXACTLY: every page in the app lives
 * under /app, so a prefix match would light it up everywhere. A trailing
 * slash on the current URL is ignored, so "/app" and "/app/" behave the same.
 */
export function isNavActive(pathname, path) {
  const current = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const to = navTo(path);
  if (!path) return current === to;
  return current === to || current.startsWith(`${to}/`);
}
