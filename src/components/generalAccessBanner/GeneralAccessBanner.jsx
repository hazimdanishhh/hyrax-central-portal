import { useState } from "react";
import { WarningIcon, XIcon } from "@phosphor-icons/react";
import { useProfile } from "../../context/ProfileContext";
import CardLayout from "../cardLayout/CardLayout";
import "./GeneralAccessBanner.scss";

const DISMISS_KEY = "generalAccessBannerDismissed";

// Shown to anyone still sitting in the default "General" department (id 1)
// -- the same signal profile.created.needs_department_assignment and the
// Users Overview "Unassigned" tile both use, so this means the same thing
// everywhere in the system. Dismissible per-session (sessionStorage, not
// localStorage) -- reappears next login since the underlying access gap is
// still genuinely unresolved, but doesn't nag on every page navigation
// within one session.
export default function GeneralAccessBanner() {
  const { profile } = useProfile();
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem(DISMISS_KEY) === "true",
  );

  if (!profile || profile.department_id !== 1 || dismissed) return null;

  function handleDismiss() {
    sessionStorage.setItem(DISMISS_KEY, "true");
    setDismissed(true);
  }

  return (
    <CardLayout style="generalAccessBanner">
      <WarningIcon size={20} weight="fill" />
      <p className="textXS">
        Your access is currently limited to the <strong>General Module </strong>
        (bare-minimum access). A system admin has been notified and will assign
        your designated department module and role shortly.
      </p>
      <button
        type="button"
        className="generalAccessBannerDismiss"
        onClick={handleDismiss}
        aria-label="Dismiss"
      >
        <XIcon size={16} />
      </button>
    </CardLayout>
  );
}
