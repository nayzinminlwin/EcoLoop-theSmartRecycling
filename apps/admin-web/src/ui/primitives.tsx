// =============================================================================
// primitives.tsx — Reusable UI control atoms, inputs, badges and headers
// Phase 4 — Accessible, typed, style-system controls for EcoLoop Admin
// =============================================================================

import * as React from "react";

// ---------------------------------------------------------------------------
// 1. Icon & Brand
// ---------------------------------------------------------------------------

export type IconName =
  | "leaf" | "home" | "scan" | "settings" | "bell"
  | "arrow" | "recycle" | "gift" | "history" | "book" | "check" | "bin"
  | "alert" | "grid" | "search" | "chart" | "shield" | "menu" | "close" | "plus" | "camera";

export interface IconProps {
  name: IconName;
  size?: number;
}

const iconPaths: Record<IconName, React.ReactNode> = {
  leaf: (
    <>
      <path d="M20 4C12 4 5 8 5 15c0 2 1 4 3 5 0-6 4-10 9-12-4 3-6 7-6 12 6 1 10-3 10-9 0-3-1-5-1-7Z" />
      <path d="M4 21c2-5 6-9 13-12" />
    </>
  ),
  home: (
    <>
      <path d="m3 11 9-8 9 8" />
      <path d="M5 10v11h14V10M9 21v-7h6v7" />
    </>
  ),
  scan: (
    <>
      <path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4" />
      <path d="M8 12h8" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19 13.5a7 7 0 0 0 0-3l2-1.5-2-3.5-2.5 1A8 8 0 0 0 14 5L13.5 2h-4L9 5a8 8 0 0 0-2.5 1.5l-2.5-1L2 9l2 1.5a7 7 0 0 0 0 3L2 15l2 3.5 2.5-1A8 8 0 0 0 9 19l.5 3h4l.5-3a8 8 0 0 0 2.5-1.5l2.5 1 2-3.5-2-1.5Z" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
    </>
  ),
  arrow: <path d="m9 18 6-6-6-6" />,
  recycle: (
    <>
      <path d="m8 4 4-2 3 5M12 2l-2 6" />
      <path d="m20 13 1 4-4 3M21 17h-7" />
      <path d="m4 18-1-4 4-3M3 14l4 7" />
    </>
  ),
  gift: (
    <>
      <rect x="3" y="8" width="18" height="13" rx="2" />
      <path d="M12 8v13M3 12h18M12 8H8a3 3 0 1 1 4-3v3Zm0 0h4a3 3 0 1 0-4-3v3Z" />
    </>
  ),
  history: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5M12 7v5l3 2" />
    </>
  ),
  book: (
    <>
      <path d="M4 5a3 3 0 0 1 3-2h5v18H7a3 3 0 0 0-3 2V5ZM20 5a3 3 0 0 0-3-2h-5v18h5a3 3 0 0 1 3 2V5Z" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  bin: (
    <>
      <path d="M4 7h16M9 3h6l1 4H8l1-4ZM6 7l1 14h10l1-14M10 11v6M14 11v6" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3 2 21h20L12 3Z" />
      <path d="M12 9v5M12 18h.01" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </>
  ),
  shield: (
    <>
      <path d="M12 2 4 5v6c0 5 3 9 8 11 5-2 8-6 8-11V5l-8-3Z" />
      <path d="m9 12 2 2 4-5" />
    </>
  ),
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  camera: (
    <>
      <rect x="3" y="5" width="18" height="15" rx="2" />
      <circle cx="12" cy="12" r="4" />
      <path d="m8 5 1-2h6l1 2" />
    </>
  )
};

export function Icon(props: IconProps): React.ReactElement {
  const { name, size = 20 } = props;
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
      {iconPaths[name]}
    </svg>
  );
}

export function Brand(): React.ReactElement {
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
// 2. Button
// ---------------------------------------------------------------------------

export interface ButtonProps {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  type?: "button" | "submit";
  disabled?: boolean;
  busy?: boolean;
  onClick?: () => void;
  testId?: string;
}

export function Button(props: ButtonProps): React.ReactElement {
  const {
    children,
    variant = "primary",
    type = "button",
    disabled = false,
    busy = false,
    onClick,
    testId
  } = props;

  return (
    <button
      type={type}
      className={`btn ${variant}${busy ? " busy" : ""}`}
      disabled={disabled || busy}
      onClick={onClick}
      data-testid={testId}
    >
      {busy ? (
        <>
          <span className="btn-spinner" aria-hidden="true" />
          <span>Processing...</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// 3. Inputs (Text, Select, Checkbox)
// ---------------------------------------------------------------------------

export interface TextInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "email" | "password" | "number" | "date" | "search";
  error?: string;
  hint?: string;
  disabled?: boolean;
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
}

export function TextInput(props: TextInputProps): React.ReactElement {
  const {
    id,
    label,
    value,
    onChange,
    type = "text",
    error,
    hint,
    disabled = false,
    required = false,
    min,
    max,
    step,
    placeholder
  } = props;

  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className={`form-field${error ? " has-error" : ""}`}>
      <label htmlFor={id} className="form-label">
        {label}
        {required && <span className="required-star" aria-hidden="true"> *</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required={required}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
        className="form-input"
      />
      {hint && !error && (
        <span id={hintId} className="form-hint">
          {hint}
        </span>
      )}
      {error && (
        <span id={errorId} className="form-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectInputProps {
  id: string;
  label: string;
  value: string;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
}

export function SelectInput(props: SelectInputProps): React.ReactElement {
  const { id, label, value, options, onChange, error, disabled = false } = props;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className={`form-field${error ? " has-error" : ""}`}>
      <label htmlFor={id} className="form-label">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={errorId}
        className="form-select"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <span id={errorId} className="form-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

export interface CheckboxInputProps {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function CheckboxInput(props: CheckboxInputProps): React.ReactElement {
  const { id, label, checked, onChange, disabled = false } = props;

  return (
    <label htmlFor={id} className="checkbox-field">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="checkbox-input"
      />
      <span className="checkbox-label">{label}</span>
    </label>
  );
}

// ---------------------------------------------------------------------------
// 4. Badge & Feedback
// ---------------------------------------------------------------------------

export type BadgeTone = "green" | "amber" | "red" | "gray";

export interface BadgeProps {
  children: React.ReactNode;
  tone?: BadgeTone;
}

export function Badge(props: BadgeProps): React.ReactElement {
  const { children, tone = "green" } = props;
  return <span className={`badge ${tone}`}>{children}</span>;
}

export interface FeedbackProps {
  kind: "success" | "error" | "info";
  children: React.ReactNode;
  onDismiss?: () => void;
}

export function Feedback(props: FeedbackProps): React.ReactElement {
  const { kind, children, onDismiss } = props;

  const iconName: IconName =
    kind === "success" ? "check" : kind === "error" ? "alert" : "shield";

  return (
    <div className={`feedback ${kind}`} role={kind === "error" ? "alert" : "status"}>
      <span className="feedback-icon">
        <Icon name={iconName} size={18} />
      </span>
      <div className="feedback-content">{children}</div>
      {onDismiss && (
        <button
          type="button"
          className="feedback-dismiss"
          onClick={onDismiss}
          aria-label="Dismiss feedback"
        >
          <Icon name="close" size={16} />
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 5. AdminPageHeader & AsyncState
// ---------------------------------------------------------------------------

export interface AdminPageHeaderProps {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function AdminPageHeader(props: AdminPageHeaderProps): React.ReactElement {
  const { eyebrow, title, description, actions } = props;

  return (
    <div className="admin-title">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {description && <p className="admin-title-desc">{description}</p>}
      </div>
      {actions && <div className="admin-title-actions">{actions}</div>}
    </div>
  );
}

export interface AsyncStateProps {
  kind: "loading" | "error" | "empty";
  title: string;
  description?: string;
  onRetry?: () => void;
}

export function AsyncState(props: AsyncStateProps): React.ReactElement {
  const { kind, title, description, onRetry } = props;

  const iconName: IconName =
    kind === "loading" ? "recycle" : kind === "error" ? "alert" : "grid";

  return (
    <div className={`async-state ${kind}`} role="status">
      <span className={`async-state-icon${kind === "loading" ? " spinning" : ""}`}>
        <Icon name={iconName} size={36} />
      </span>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
