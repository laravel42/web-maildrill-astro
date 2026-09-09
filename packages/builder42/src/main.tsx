import React from "react";
import ReactDOM from "react-dom/client";
import "./i18n"; // i18n setup — must be before App (docs/12-i18n §A)
import { App } from "./app/App";
import { bootstrapDemoSite } from "./bootstrap";
import "./styles/chrome.css";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Could not find #root element");

// Carga el sitio de ejemplo ANTES de montar React (docs/27 §5 Fase 2): evita
// que `StrictMode` la re-dispare como pasaría si viviera en un efecto.
bootstrapDemoSite();

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
