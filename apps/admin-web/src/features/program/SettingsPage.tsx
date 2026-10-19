// =============================================================================
// SettingsPage.tsx — System configuration, alert thresholds & material rates
// Phase 9 — Dirty draft tracking, useBlocker navigation guard & atomic settings
// =============================================================================

import * as React from "react";
import { useBlocker } from "react-router-dom";
import { services, useObservableQuery, useMutation } from "../../app/services.ts";
import type {
  AdminSettings,
  SettingsInput
} from "../../contracts/admin.ts";
import type { MaterialType, MaterialRate } from "../../contracts/shared.ts";
import {
  AdminPageHeader,
  Button,
  Feedback,
  AsyncState,
  Icon
} from "../../ui/primitives.tsx";
import { ConfirmDialog } from "../../ui/Modal.tsx";
import "./program.css";

// ---------------------------------------------------------------------------
// 1. Local Contracts & Types
// ---------------------------------------------------------------------------

export type ProgramMaterial = "plastic" | "aluminium" | "paper" | "glass";

interface SettingsFormState {
  capacityAlertThreshold: "75" | "80" | "85";
  acceptedMaterials: MaterialType[];
  rateInputs: Record<ProgramMaterial, string>;
}

type SettingsFormErrors = Partial<
  Record<
    | "capacityAlertThreshold"
    | "acceptedMaterials"
    | ProgramMaterial,
    string
  >
>;

const MATERIAL_DISPLAY_NAMES: Record<ProgramMaterial, string> = {
  plastic: "Plastic",
  aluminium: "Metal / Aluminium",
  paper: "Paper & Cardboard",
  glass: "Glass"
};

const ALL_PROGRAM_MATERIALS: ProgramMaterial[] = ["plastic", "aluminium", "paper", "glass"];

function cloneForm(state: SettingsFormState): SettingsFormState {
  return {
    capacityAlertThreshold: state.capacityAlertThreshold,
    acceptedMaterials: [...state.acceptedMaterials],
    rateInputs: { ...state.rateInputs }
  };
}

// ---------------------------------------------------------------------------
// 2. SettingsPage Component
// ---------------------------------------------------------------------------

export function SettingsPage(): React.ReactElement {
  // Unconditional observation of AdminSettings
  const settingsQuery = useObservableQuery<AdminSettings>("settings", () =>
    services.repositories.settings.watch()
  );

  const saveMutation = useMutation();

  // Local Form Draft State
  const [draft, setDraft] = React.useState<SettingsFormState | null>(null);
  const [savedSnapshot, setSavedSnapshot] = React.useState<SettingsFormState | null>(null);
  const [errors, setErrors] = React.useState<SettingsFormErrors>({});
  const [isDirty, setIsDirty] = React.useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = React.useState<boolean>(false);

  // Initialize and preserve dirty draft across new snapshots:
  // "copy its three editable fields into local draft once per initial load/save, preserving a dirty draft across new snapshots."
  React.useEffect(() => {
    if (settingsQuery.data && (!draft || !isDirty)) {
      const ratesRecord: Record<"plastic" | "aluminium" | "paper" | "glass", string> = {
        plastic: "0",
        aluminium: "0",
        paper: "0",
        glass: "0"
      };

      for (const r of settingsQuery.data.materialRates) {
        if (r.materialType in ratesRecord) {
          ratesRecord[r.materialType as keyof typeof ratesRecord] = String(
            r.pointsPerItem
          );
        }
      }

      const initial: SettingsFormState = {
        capacityAlertThreshold: String(
          settingsQuery.data.capacityAlertThreshold
        ) as "75" | "80" | "85",
        acceptedMaterials: [...settingsQuery.data.acceptedMaterials],
        rateInputs: ratesRecord
      };

      setDraft(initial);
      setSavedSnapshot(initial);
      setIsDirty(false);
    }
  }, [settingsQuery.data]);

  // Unconditional React Router blocker
  // "Call useBlocker(dirty && !pending) unconditionally from react-router-dom and use ConfirmDialog for in-app navigation"
  const blocker = useBlocker(isDirty && !saveMutation.pending);

  // Browser beforeunload event while dirty
  React.useEffect(() => {
    if (!isDirty || saveMutation.pending) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty, saveMutation.pending]);

  // Handlers for Form Changes
  const handleThresholdChange = (val: "75" | "80" | "85") => {
    if (!draft) return;
    setDraft({ ...draft, capacityAlertThreshold: val });
    setIsDirty(true);
    setSaveSuccess(false);
    if (errors.capacityAlertThreshold) {
      setErrors({ ...errors, capacityAlertThreshold: undefined });
    }
  };

  const handleToggleMaterial = (material: MaterialType) => {
    if (!draft) return;
    const isAccepted = draft.acceptedMaterials.includes(material);
    const updated = isAccepted
      ? draft.acceptedMaterials.filter((m) => m !== material)
      : [...draft.acceptedMaterials, material];

    setDraft({ ...draft, acceptedMaterials: updated });
    setIsDirty(true);
    setSaveSuccess(false);
    if (errors.acceptedMaterials) {
      setErrors({ ...errors, acceptedMaterials: undefined });
    }
  };

  const handleRateChange = (material: "plastic" | "aluminium" | "paper" | "glass", value: string) => {
    if (!draft) return;
    setDraft({
      ...draft,
      rateInputs: {
        ...draft.rateInputs,
        [material]: value
      }
    });
    setIsDirty(true);
    setSaveSuccess(false);
    if (errors[material]) {
      setErrors({ ...errors, [material]: undefined });
    }
  };

  // Cancel Handler: restores last saved snapshot
  const handleCancel = () => {
    if (savedSnapshot) {
      setDraft(cloneForm(savedSnapshot));
      setIsDirty(false);
      setErrors({});
      setSaveSuccess(false);
      saveMutation.clearError();
    }
  };

  // Validation
  const validate = (): boolean => {
    if (!draft) return false;
    const newErrors: SettingsFormErrors = {};

    if (!draft.capacityAlertThreshold || !["75", "80", "85"].includes(draft.capacityAlertThreshold)) {
      newErrors.capacityAlertThreshold = "Valid threshold (75%, 80%, or 85%) is required";
    }

    if (draft.acceptedMaterials.length === 0) {
      newErrors.acceptedMaterials = "At least one accepted material category must be selected";
    }

    const knownMaterials: ("plastic" | "aluminium" | "paper" | "glass")[] = [
      "plastic",
      "aluminium",
      "paper",
      "glass"
    ];

    for (const m of knownMaterials) {
      const val = Number(draft.rateInputs[m]);
      if (
        draft.rateInputs[m] === "" ||
        !Number.isInteger(val) ||
        val < 0 ||
        val > 1000
      ) {
        newErrors[m] = "Must be an integer between 0 and 1000";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Save Submission
  const handleSave = async () => {
    if (!draft || !validate()) return;

    saveMutation.clearError();
    setSaveSuccess(false);

    // Build MaterialRate list in repository order, setting eligible flag according to acceptedMaterials
    const materialRates: MaterialRate[] = (settingsQuery.data?.materialRates ?? []).map(
      (mr) => {
        const key = mr.materialType as keyof typeof draft.rateInputs;
        const pts = Number(draft.rateInputs[key] ?? 0);
        const isEligible = draft.acceptedMaterials.includes(mr.materialType);
        return {
          materialType: mr.materialType,
          displayName: mr.displayName,
          pointsPerItem: pts,
          eligible: isEligible
        };
      }
    );

    const input: SettingsInput = {
      capacityAlertThreshold: Number(draft.capacityAlertThreshold) as 75 | 80 | 85,
      acceptedMaterials: draft.acceptedMaterials,
      materialRates
    };

    const result = await saveMutation.run(() =>
      services.repositories.settings.update(input)
    );

    if (result) {
      const newSnapshot: SettingsFormState = {
        capacityAlertThreshold: String(result.capacityAlertThreshold) as "75" | "80" | "85",
        acceptedMaterials: [...result.acceptedMaterials],
        rateInputs: { ...draft.rateInputs }
      };
      setSavedSnapshot(newSnapshot);
      setIsDirty(false);
      setSaveSuccess(true);
    }
  };

  // Loading & Error States for Initial Load
  if (settingsQuery.loading && !draft) {
    return (
      <div style={{ padding: "48px 0", textAlign: "center" }}>
        <AsyncState
          kind="loading"
          title="Loading program configuration..."
          description="Fetching alert thresholds and material calculation rates."
        />
      </div>
    );
  }

  if (settingsQuery.error && !draft) {
    return (
      <div style={{ padding: "48px 0" }}>
        <AsyncState
          kind="error"
          title="Unable to load configuration"
          description={settingsQuery.error}
          onRetry={settingsQuery.reload}
        />
      </div>
    );
  }

  if (!draft) {
    return (
      <div style={{ padding: "48px 0" }}>
        <AsyncState kind="empty" title="Configuration settings not found" />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Page Header */}
      <AdminPageHeader
        eyebrow="SYSTEM CONFIGURATION"
        title="Settings"
        description="Configure operational capacity thresholds, accepted material streams, and resident points reward rules."
        actions={
          <div style={{ display: "flex", gap: "10px" }}>
            {isDirty && (
              <Button
                variant="ghost"
                disabled={saveMutation.pending}
                onClick={handleCancel}
              >
                Cancel
              </Button>
            )}
            <Button
              variant="primary"
              busy={saveMutation.pending}
              disabled={!isDirty}
              onClick={handleSave}
            >
              <Icon name="check" size={16} /> Save settings
            </Button>
          </div>
        }
      />

      {/* Success Notification Banner */}
      {saveSuccess && (
        <div className="success-banner" role="status">
          <Icon name="check" size={20} />
          <div>
            <b>Settings saved</b>
            <span>New configuration rules and calculation rates are now active township-wide.</span>
          </div>
        </div>
      )}

      {/* Mutation Error Notification */}
      {saveMutation.error && (
        <Feedback kind="error" onDismiss={saveMutation.clearError}>
          {saveMutation.error}
        </Feedback>
      )}

      {/* Settings Sections Stack */}
      <div className="settings-stack">
        {/* Section 1: Alert Threshold */}
        <section className="setting-section">
          <div className="setting-section-intro">
            <div className="icon-wrap">
              <Icon name="alert" size={22} />
            </div>
            <h2>Capacity alert threshold</h2>
            <p>
              Trigger a priority operational alert whenever any smart bin sensor detects fill level
              at or above this threshold.
            </p>
          </div>
          <div className="setting-controls">
            <div className="threshold-select-wrap">
              <label
                htmlFor="threshold-select"
                style={{ fontSize: "13px", fontWeight: 700, color: "var(--text)" }}
              >
                Trigger Threshold Percentage
              </label>
              <select
                id="threshold-select"
                className="form-select"
                value={draft.capacityAlertThreshold}
                onChange={(e) =>
                  handleThresholdChange(e.target.value as "75" | "80" | "85")
                }
                style={{
                  height: "42px",
                  borderRadius: "10px",
                  border: "1px solid var(--line)",
                  padding: "0 12px",
                  fontSize: "14px",
                  fontWeight: 600,
                  background: "white"
                }}
              >
                <option value="75">75% — Early collection trigger</option>
                <option value="80">80% — Standard operational trigger</option>
                <option value="85">85% — Urgent capacity warning</option>
              </select>
              {errors.capacityAlertThreshold && (
                <span className="form-error" role="alert">
                  {errors.capacityAlertThreshold}
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Section 2: Accepted Material Categories */}
        <section className="setting-section">
          <div className="setting-section-intro">
            <div className="icon-wrap">
              <Icon name="recycle" size={22} />
            </div>
            <h2>Accepted material categories</h2>
            <p>
              Select which verified recycling streams qualify for resident EcoPoints issuance and
              township processing.
            </p>
          </div>
          <div className="setting-controls">
            <div className="material-options">
              {ALL_PROGRAM_MATERIALS.map((mat) => {
                const isChecked = draft.acceptedMaterials.includes(mat);
                return (
                  <label
                    key={mat}
                    className={`material-option-card ${isChecked ? "selected" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggleMaterial(mat)}
                    />
                    <span>{MATERIAL_DISPLAY_NAMES[mat]}</span>
                  </label>
                );
              })}
            </div>
            {errors.acceptedMaterials && (
              <span className="form-error" role="alert">
                {errors.acceptedMaterials}
              </span>
            )}
          </div>
        </section>

        {/* Section 3: EcoPoints Calculation Rates */}
        <section className="setting-section">
          <div className="setting-section-intro">
            <div className="icon-wrap">
              <Icon name="leaf" size={22} />
            </div>
            <h2>EcoPoints calculation rules</h2>
            <p>
              Specify the points awarded per accepted recyclable piece or container during verified
              deposit sessions.
            </p>
          </div>
          <div className="setting-controls">
            <div className="rate-options">
              {ALL_PROGRAM_MATERIALS.map((mat) => {
                const isAccepted = draft.acceptedMaterials.includes(mat);
                const hasError = Boolean(errors[mat]);
                return (
                  <div
                    key={mat}
                    className={`rate-option-card ${hasError ? "has-error" : ""}`}
                  >
                    <div>
                      <span className="material-name">{MATERIAL_DISPLAY_NAMES[mat]}</span>
                      {!isAccepted && (
                        <div style={{ marginTop: "2px" }}>
                          <small style={{ color: "var(--amber)" }}>Not eligible for points</small>
                        </div>
                      )}
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={1000}
                      value={draft.rateInputs[mat]}
                      onChange={(e) =>
                        handleRateChange(
                          mat as "plastic" | "aluminium" | "paper" | "glass",
                          e.target.value
                        )
                      }
                      aria-label={`${MATERIAL_DISPLAY_NAMES[mat]} rate`}
                    />
                    <small>pts/item</small>
                    {hasError && (
                      <span
                        className="form-error"
                        role="alert"
                        style={{ gridColumn: "1 / -1", marginTop: "4px" }}
                      >
                        {errors[mat]}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      {/* Unsaved Changes Confirmation Dialog (from useBlocker) */}
      <ConfirmDialog
        open={blocker.state === "blocked"}
        title="Unsaved Changes"
        description="You have unsaved changes to your program settings and calculation rates. If you leave now, these changes will be discarded."
        confirmLabel="Discard and Leave"
        variant="danger"
        busy={false}
        error={null}
        onConfirm={() => {
          if (blocker.state === "blocked") {
            blocker.proceed();
          }
        }}
        onCancel={() => {
          if (blocker.state === "blocked") {
            blocker.reset();
          }
        }}
      />
    </div>
  );
}
