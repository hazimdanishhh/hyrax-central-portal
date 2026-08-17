import "./ProgressBar.scss";

// Hand-rolled div bar, following the only existing precedent in this
// codebase (LeadsScoreCard.jsx's quotaBarContainer/quotaBarFill) -- but
// with real ARIA progressbar semantics added, since that precedent has
// none and this needs to be production-ready.
//
// `value` is null (not 0) when there are zero non-cancelled tasks in the
// project (see project_progress view) -- rendered as "No tasks yet"
// rather than a misleading 0%, per req #9.
export default function ProgressBar({ value, label }) {
  if (value == null) {
    return (
      <div className="progressBarContainer">
        <p className="textRegular textXXXS progressBarEmptyLabel">
          No tasks yet
        </p>
      </div>
    );
  }

  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div className="progressBarContainer">
      <div
        className="progressBarTrack"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || "Progress"}
      >
        <div className="progressBarFill" style={{ width: `${clamped}%` }} />
      </div>
      <span className="textRegular textXXXS progressBarValueLabel">
        {clamped}%
      </span>
    </div>
  );
}
