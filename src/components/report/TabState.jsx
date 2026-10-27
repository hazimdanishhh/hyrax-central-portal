// src/components/report/TabState.jsx

import { CircleNotchIcon } from "@phosphor-icons/react";
import CardLayout from "../cardLayout/CardLayout";
import LoadingIcon from "../loadingIcon/LoadingIcon";
import NoResult from "../crud/noResult/NoResult";
import "./TabState.scss";

/**
 * Loading / updating / error states for a report page or tab
 * (DASHBOARD-CONVENTIONS §8). A tab's own failure shows here and nowhere
 * else -- the other tabs keep working.
 *
 *   isLoading   first load, nothing to show yet -> spinner
 *   isUpdating  (2026-10-23) new figures are on their way after a period or
 *               filter change: the previous figures stay on screen, dimmed
 *               and not clickable, under a floating "Updating figures…"
 *               pill -- so a change is always visibly acknowledged, with no
 *               blank page and no layout jump. The pill is left out of PDF
 *               exports.
 *   error       the access-denied case gets its own wording
 *
 * Lists use the updating state too (2026-10-27): the KPI cards ("Updating
 * figures…") and the rows ("Updating leads…") while a period, filter,
 * search, sort or page change loads.
 */
export default function TabState({
  isLoading,
  isUpdating = false,
  updatingLabel = "Updating figures…",
  error,
  children,
}) {
  if (isLoading) {
    return (
      <CardLayout style="cardLayoutFlexFull">
        <LoadingIcon />
      </CardLayout>
    );
  }
  if (error) {
    const denied = /access denied/i.test(error.message ?? "");
    return (
      <CardLayout style="cardLayoutFlexFull">
        <NoResult
          title={
            denied
              ? "You don't have access to this report."
              : "This couldn't load. Try again, or pick another tab."
          }
        />
        {/* The database's own message (and code), so a failure can be
            diagnosed from the page instead of guessed at. */}
        {!denied && (error.message || error.code) && (
          <p className="textXXS textLight" style={{ textAlign: "center" }}>
            {[error.code, error.message].filter(Boolean).join(" · ")}
          </p>
        )}
      </CardLayout>
    );
  }
  return (
    <div
      className={`reportContent ${isUpdating ? "updating" : ""}`}
      aria-busy={isUpdating}
    >
      <div
        className="reportUpdatingPill"
        role="status"
        aria-live="polite"
        data-html2canvas-ignore="true"
      >
        {isUpdating && (
          <span className="textXXS">
            <CircleNotchIcon size={14} className="reportUpdatingSpinner" />
            {updatingLabel}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
