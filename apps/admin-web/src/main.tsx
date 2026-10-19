import * as React from "react";
import { createRoot } from "react-dom/client";
import "./theme.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/inter/800.css";

// ---------------------------------------------------------------------------
// Icon primitive (inline SVG, stroke-based, no icon library dependency)
// ---------------------------------------------------------------------------
type IconName = "leaf";

const paths: Record<IconName, React.ReactElement> = {
  leaf: (
    <>
      <path d="M20 4C12 4 5 8 5 15c0 2 1 4 3 5 0-6 4-10 9-12-4 3-6 7-6 12 6 1 10-3 10-9 0-3-1-5-1-7Z" />
      <path d="M4 21c2-5 6-9 13-12" />
    </>
  ),
};

function Icon({
  name,
  size = 22,
}: {
  name: IconName;
  size?: number;
}): React.ReactElement {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Brand mark
// ---------------------------------------------------------------------------
function Brand(): React.ReactElement {
  return (
    <div className="brand">
      <span className="brand-mark">
        <Icon name="leaf" />
      </span>
      <span>
        EcoLoop <b>AI</b>
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bootstrap preview — Phase 1 entry point
// No business records, no domain models, no admin shell geometry.
// Shell geometry and router wiring are introduced in Phase 6.
// ---------------------------------------------------------------------------
export function BootstrapPreview(): React.ReactElement {
  return (
    <main className="bootstrap-preview">
      <div className="bootstrap-card">
        <Brand />
        <h1>Admin Portal</h1>
        <p style={{ color: "var(--muted)", fontSize: "13px", lineHeight: 1.6 }}>
          Phase 1 — theme and project scaffold confirmed.
          <br />
          Shell, router, and feature screens follow in Phases 6–9.
        </p>
        <span className="bootstrap-status">Ready — no Firebase calls</span>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Mount
// ---------------------------------------------------------------------------
const container = document.getElementById("root");
if (!container) throw new Error("Root element #root not found in index.html");
createRoot(container).render(<BootstrapPreview />);
