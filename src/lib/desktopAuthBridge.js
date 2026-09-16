import { supabase } from "./supabaseClient";

// True only inside the hyrax-portal-desktop Tauri wrapper, never in a browser tab.
export const isTauri = () =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

async function completeSessionFromUrl(url) {
  if (!url) return;
  const code = new URL(url).searchParams.get("code");
  if (!code) return;

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) console.error("Desktop OAuth exchange failed:", error.message);
}

/**
 * Picks up the Google OAuth session handed back from the system browser via
 * the hyraxportal:// deep link (registered by hyrax-portal-desktop). Google
 * no longer allows completing OAuth inside an embedded webview, so desktop
 * login opens the system browser instead and rejoins the app here. No-ops
 * outside the desktop app.
 */
export async function listenForDesktopOAuthCallback() {
  if (!isTauri()) return () => {};

  const { getCurrent, onOpenUrl } = await import("@tauri-apps/plugin-deep-link");
  const { listen } = await import("@tauri-apps/api/event");

  const initialUrls = await getCurrent();
  if (initialUrls?.length) completeSessionFromUrl(initialUrls[0]);

  const unlistenOpenUrl = await onOpenUrl((urls) => completeSessionFromUrl(urls?.[0]));
  // Also driven directly by the Rust side (src-tauri/src/lib.rs) for the
  // Windows/Linux case where the OS hands the URL off via a new-instance
  // launch rather than firing onOpenUrl on the running instance.
  const unlistenEvent = await listen("oauth-callback", (event) =>
    completeSessionFromUrl(event.payload),
  );

  return () => {
    unlistenOpenUrl();
    unlistenEvent();
  };
}
