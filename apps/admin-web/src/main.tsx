import * as React from "react";
import { createRoot } from "react-dom/client";
import "./theme.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/inter/800.css";

import {
  Icon,
  Brand,
  Button,
  TextInput,
  SelectInput,
  CheckboxInput,
  Badge,
  Feedback,
  AdminPageHeader,
  AsyncState
} from "./ui/primitives.tsx";
import { Modal, ConfirmDialog } from "./ui/Modal.tsx";

// ---------------------------------------------------------------------------
// BootstrapPreview — Phase 4 Controlled Interactive Component Showcase
// Exercises all primitive exports, dialogs, inputs, feedback & badges.
// No business/customer records; UI demo state only.
// ---------------------------------------------------------------------------
export function BootstrapPreview(): React.ReactElement {
  const [text, setText] = React.useState("");
  const [selectVal, setSelectVal] = React.useState("option1");
  const [checked, setChecked] = React.useState(false);
  const [feedbackVisible, setFeedbackVisible] = React.useState(true);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [confirmBusy, setConfirmBusy] = React.useState(false);
  const [confirmError, setConfirmError] = React.useState<string | null>(null);

  const selectOptions = [
    { value: "option1", label: "Active selection" },
    { value: "option2", label: "Draft mode" },
    { value: "option3", label: "Archived setting" }
  ];

  const handleConfirm = () => {
    setConfirmBusy(true);
    setConfirmError(null);
    setTimeout(() => {
      setConfirmBusy(false);
      setConfirmOpen(false);
    }, 600);
  };

  return (
    <main style={{ maxWidth: "1080px", margin: "0 auto", padding: "40px 24px" }}>
      <AdminPageHeader
        eyebrow="PHASE 4 COMPONENT SHOWCASE"
        title="Admin UI Primitives & Dialogs"
        description="Controlled showcase of reusable design-system atoms, form inputs, feedback, and focus-trapped dialogs."
        actions={
          <div style={{ display: "flex", gap: "10px" }}>
            <Button variant="secondary" onClick={() => setModalOpen(true)}>
              <Icon name="grid" size={16} /> Open Modal
            </Button>
            <Button variant="primary" onClick={() => setConfirmOpen(true)}>
              <Icon name="check" size={16} /> Open Confirm Dialog
            </Button>
          </div>
        }
      />

      <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
        {/* Brand & Badges */}
        <section
          style={{
            background: "var(--surface)",
            padding: "24px",
            borderRadius: "var(--radius)",
            border: "1px solid var(--line)"
          }}
        >
          <h2 style={{ fontSize: "16px", marginBottom: "16px" }}>1. Brand Mark & Badges</h2>
          <div style={{ display: "flex", alignItems: "center", gap: "24px", flexWrap: "wrap" }}>
            <Brand />
            <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
              <Badge tone="green">Verified (Green)</Badge>
              <Badge tone="amber">Pending (Amber)</Badge>
              <Badge tone="red">Critical (Red)</Badge>
              <Badge tone="gray">Draft (Gray)</Badge>
            </div>
          </div>
        </section>

        {/* Buttons */}
        <section
          style={{
            background: "var(--surface)",
            padding: "24px",
            borderRadius: "var(--radius)",
            border: "1px solid var(--line)"
          }}
        >
          <h2 style={{ fontSize: "16px", marginBottom: "16px" }}>2. Button Variants & States</h2>
          <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
            <Button variant="primary">
              <Icon name="plus" size={16} /> Primary Button
            </Button>
            <Button variant="secondary">
              <Icon name="search" size={16} /> Secondary Button
            </Button>
            <Button variant="danger">
              <Icon name="bin" size={16} /> Danger Button
            </Button>
            <Button variant="ghost">Ghost Button</Button>
            <Button variant="primary" disabled>
              Disabled
            </Button>
            <Button variant="primary" busy>
              Busy State
            </Button>
          </div>
        </section>

        {/* Form Inputs */}
        <section
          style={{
            background: "var(--surface)",
            padding: "24px",
            borderRadius: "var(--radius)",
            border: "1px solid var(--line)"
          }}
        >
          <h2 style={{ fontSize: "16px", marginBottom: "16px" }}>3. Form Controls</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "20px"
            }}
          >
            <TextInput
              id="demo-text"
              label="Standard Text Input"
              value={text}
              onChange={setText}
              placeholder="Type something..."
              hint="Help text appears below the input"
            />
            <TextInput
              id="demo-error-text"
              label="Input With Validation Error"
              value=""
              onChange={() => {}}
              placeholder="Invalid value..."
              error="This field is required"
            />
            <SelectInput
              id="demo-select"
              label="Dropdown Select"
              value={selectVal}
              options={selectOptions}
              onChange={setSelectVal}
            />
            <div style={{ display: "flex", alignItems: "center", marginTop: "24px" }}>
              <CheckboxInput
                id="demo-checkbox"
                label="Interactive confirmation checkbox"
                checked={checked}
                onChange={setChecked}
              />
            </div>
          </div>
        </section>

        {/* Feedback Messages */}
        <section
          style={{
            background: "var(--surface)",
            padding: "24px",
            borderRadius: "var(--radius)",
            border: "1px solid var(--line)"
          }}
        >
          <h2 style={{ fontSize: "16px", marginBottom: "16px" }}>4. Feedback Alerts</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {feedbackVisible && (
              <Feedback kind="success" onDismiss={() => setFeedbackVisible(false)}>
                Settings updated successfully. All changes are stored locally in the mock repository.
              </Feedback>
            )}
            {!feedbackVisible && (
              <Button variant="ghost" onClick={() => setFeedbackVisible(true)}>
                Restore dismissed success alert
              </Button>
            )}
            <Feedback kind="error">
              Simulated validation failure. Please check your entries before resubmitting.
            </Feedback>
            <Feedback kind="info">
              Offline mock demonstration mode active — no remote Firebase or network requests.
            </Feedback>
          </div>
        </section>

        {/* Async State Callouts */}
        <section
          style={{
            background: "var(--surface)",
            padding: "24px",
            borderRadius: "var(--radius)",
            border: "1px solid var(--line)"
          }}
        >
          <h2 style={{ fontSize: "16px", marginBottom: "16px" }}>5. Async State Representation</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "16px"
            }}
          >
            <div style={{ border: "1px dashed var(--line)", borderRadius: "var(--radius)" }}>
              <AsyncState
                kind="loading"
                title="Loading data..."
                description="Simulating asynchronous repository latency."
              />
            </div>
            <div style={{ border: "1px dashed var(--line)", borderRadius: "var(--radius)" }}>
              <AsyncState
                kind="empty"
                title="No items found"
                description="Try adjusting your filters or search terms."
              />
            </div>
            <div style={{ border: "1px dashed var(--line)", borderRadius: "var(--radius)" }}>
              <AsyncState
                kind="error"
                title="Failed to load"
                description="Injected error simulated for testing."
                onRetry={() => alert("Retry clicked")}
              />
            </div>
          </div>
        </section>
      </div>

      {/* Modal Dialog */}
      <Modal
        open={modalOpen}
        title="Reusable Modal Dialog"
        onClose={() => setModalOpen(false)}
        footer={
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Close
            </Button>
            <Button variant="primary" onClick={() => setModalOpen(false)}>
              Done
            </Button>
          </div>
        }
      >
        <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.6 }}>
          This dialog uses React Portal into <code>document.body</code>, traps keyboard focus within its
          boundaries, closes on Escape or overlay click, and restores focus to its trigger button on close.
        </p>
      </Modal>

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={confirmOpen}
        title="Confirm Operation"
        description="Are you sure you want to proceed with this simulated admin action? This demonstrates the busy state and error handling inside dialogs."
        confirmLabel="Confirm Action"
        busy={confirmBusy}
        error={confirmError}
        onConfirm={handleConfirm}
        onCancel={() => {
          setConfirmOpen(false);
          setConfirmError(null);
        }}
      />
    </main>
  );
}

// ---------------------------------------------------------------------------
// Mount
// ---------------------------------------------------------------------------
const container = document.getElementById("root");
if (!container) throw new Error("Root element #root not found in index.html");
createRoot(container).render(<BootstrapPreview />);
