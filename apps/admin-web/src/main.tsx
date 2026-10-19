// =============================================================================
// main.tsx — EcoLoop Admin Web Portal Application Root
// Phase 6 — Mount AdminRouter with complete theme, fonts, and shell styles
// =============================================================================

import * as React from "react";
import { createRoot } from "react-dom/client";
import "./theme.css";
import "./ui/data-table.css";
import "./app/shell.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/inter/800.css";

import { AdminRouter } from "./app/router.tsx";

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <AdminRouter />
    </React.StrictMode>
  );
}
