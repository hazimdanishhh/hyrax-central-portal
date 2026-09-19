import React from "react";
import ReactDOM from "react-dom/client";
import { Navigate, BrowserRouter, Route, Routes } from "react-router-dom";
import "./styles/index.scss";
import "./styles/fonts.scss";
import "./styles/sections.scss";
import AppProviders from "./routes/AppProviders";
import AppRouter from "./routes/AppRouter";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppProviders>
      <AppRouter />
    </AppProviders>
  </React.StrictMode>,
);

// PROD-only -- registering this under `vite dev` (or `tauri dev`, which
// serves through the same Vite dev server) makes the browser cache-first
// intercept dev-only assets (/@vite/client, HMR chunks, optimize-deps
// output) via a Service Worker whose cache never invalidates on content
// change, causing stale React/emotion chunks to load alongside fresh ones --
// producing duplicate React instances and "Invalid hook call" crashes on
// every fresh tab.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(console.error);
  });
}
