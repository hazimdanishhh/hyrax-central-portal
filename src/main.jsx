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
