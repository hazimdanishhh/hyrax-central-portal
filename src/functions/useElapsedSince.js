import { useEffect, useState } from "react";

/**
 * Live "Xh Ym" elapsed-time string since `startDate`, ticking once a
 * minute. For an open (not yet clocked-out) remote session --
 * employees_public.last_status_time freezes at the clock-in moment for as
 * long as the session stays open (it only moves again on the next real
 * event), so this is what actually keeps moving on the card while someone's
 * still working remote.
 */
export default function useElapsedSince(startDate) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!startDate) return;

    const interval = setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => clearInterval(interval);
  }, [startDate]);

  if (!startDate) return null;

  const start = new Date(startDate).getTime();
  const diffMinutes = Math.max(0, Math.round((now - start) / 60000));
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;

  return hours === 0 ? `${minutes}m` : `${hours}h ${minutes}m`;
}
