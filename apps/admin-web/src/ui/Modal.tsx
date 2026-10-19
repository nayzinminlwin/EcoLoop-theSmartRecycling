// =============================================================================
// Modal.tsx — Accessible modal dialog and confirm dialog components
// Phase 4 — Portal-mounted, focus-trapped, accessible dialogs
// =============================================================================

import * as React from "react";
import { createPortal } from "react-dom";
import { Icon, Button, Feedback } from "./primitives.tsx";

export interface ModalProps {
  open: boolean;
  title: string;
  children: React.ReactNode;
  footer: React.ReactNode;
  onClose: () => void;
  closeDisabled?: boolean;
}

export function Modal(props: ModalProps): React.ReactElement | null {
  const { open, title, children, footer, onClose, closeDisabled = false } = props;

  const dialogRef = React.useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = React.useRef<HTMLElement | null>(null);

  // Focus restoration & body scroll lock
  React.useEffect(() => {
    if (!open) return;

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Focus first focusable element inside modal or dialog itself
    const focusTimer = setTimeout(() => {
      if (dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length > 0) {
          focusable[0].focus();
        } else {
          dialogRef.current.focus();
        }
      }
    }, 10);

    return () => {
      clearTimeout(focusTimer);
      document.body.style.overflow = originalOverflow;
      if (previouslyFocusedRef.current && typeof previouslyFocusedRef.current.focus === "function") {
        previouslyFocusedRef.current.focus();
      }
    };
  }, [open]);

  // Focus trap & Escape key
  React.useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (!closeDisabled) {
          event.stopPropagation();
          onClose();
        }
        return;
      }

      if (event.key === "Tab" && dialogRef.current) {
        const focusable = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        );

        if (focusable.length === 0) {
          event.preventDefault();
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey) {
          if (document.activeElement === first) {
            event.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, closeDisabled, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="dialog-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !closeDisabled) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-dialog-title"
        tabIndex={-1}
        className="dialog"
      >
        <div className="dialog-header">
          <h2 id="modal-dialog-title">{title}</h2>
          {!closeDisabled && (
            <button
              type="button"
              className="dialog-close-btn"
              onClick={onClose}
              aria-label="Close dialog"
            >
              <Icon name="close" size={18} />
            </button>
          )}
        </div>
        <div className="dialog-body">{children}</div>
        <div className="dialog-footer">{footer}</div>
      </div>
    </div>,
    document.body
  );
}

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  variant?: "primary" | "danger";
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog(props: ConfirmDialogProps): React.ReactElement | null {
  const {
    open,
    title,
    description,
    confirmLabel,
    variant = "primary",
    busy,
    error,
    onConfirm,
    onCancel
  } = props;

  const footer = (
    <div className="dialog-actions">
      <Button variant="ghost" disabled={busy} onClick={onCancel}>
        Cancel
      </Button>
      <Button variant={variant} busy={busy} onClick={onConfirm}>
        {confirmLabel}
      </Button>
    </div>
  );

  return (
    <Modal
      open={open}
      title={title}
      footer={footer}
      onClose={onCancel}
      closeDisabled={busy}
    >
      <div className="confirm-dialog-content">
        <p className="confirm-dialog-desc">{description}</p>
        {error && (
          <div style={{ marginTop: "14px" }}>
            <Feedback kind="error">{error}</Feedback>
          </div>
        )}
      </div>
    </Modal>
  );
}
