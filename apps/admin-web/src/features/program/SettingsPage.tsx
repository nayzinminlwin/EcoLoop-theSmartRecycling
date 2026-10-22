// =============================================================================
// SettingsPage.tsx — System configuration, alert thresholds & material rates
// Phase AB-05 — Immutable program settings and future-policy publication
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
  acceptedClasses: string[];
  rateInputs: Record<ProgramMaterial, string>;
}

type SettingsFormErrors = Partial<
  Record<
    | "capacityAlertThreshold"
    | "acceptedClasses"
    | ProgramMaterial,
    string
  >
>;

const MATERIAL_DISPLAY_NAMES: Record<ProgramMaterial, string> = {
  plastic: "Plastic",
  aluminium: "Metal / Aluminium",
  paper: "Paper (Cardboard excluded)",
  glass: "Glass"
};

const ALL_PROGRAM_MATERIALS: ProgramMaterial[] = ["plastic", "aluminium", "paper", "glass"];

interface ClassDef {
  id: string;
  label: string;
  description: string;
  category: ProgramMaterial;
  excluded?: boolean;
  exclusionReason?: string;
}

const PROGRAM_CLASS_GROUPS: {
  category: ProgramMaterial;
  title: string;
  classes: ClassDef[];
}[] = [
  {
    category: "plastic",
    title: "Plastic Stream",
    classes: [
      {
        id: "plastic_bottle",
        label: "Plastic bottles",
        description: "Clean PET and HDPE beverage bottles and liquid containers",
        category: "plastic",
      },
    ],
  },
  {
    category: "aluminium",
    title: "Metal / Aluminium Stream",
    classes: [
      {
        id: "aluminium_can",
        label: "Aluminium cans",
        description: "Clean beverage cans (generic metal cans require subtype inspection)",
        category: "aluminium",
      },
    ],
  },
  {
    category: "glass",
    title: "Glass Stream",
    classes: [
      {
        id: "glass_bottle",
        label: "Glass bottles",
        description: "Clean beverage and food jars (broken glassware and window panes excluded)",
        category: "glass",
      },
    ],
  },
  {
    category: "paper",
    title: "Paper Stream & Excluded Cardboard",
    classes: [
      {
        id: "paper_item",
        label: "Paper items",
        description: "Clean office paper, notebooks, mail, flyers, and magazines",
        category: "paper",
      },
      {
        id: "paper_bag",
        label: "Paper bags",
        description: "Clean unlined paper grocery and shopping bags",
        category: "paper",
      },
      {
        id: "cardboard_item",
        label: "Cardboard (Boxes & Cartons)",
        description: "Bulky corrugated cardboard and packaging boxes",
        category: "paper",
        excluded: true,
        exclusionReason: "Excluded from smart bin acceptance — Bulky stream must be brought to manual recycling hubs",
      },
    ],
  },
];

function cloneForm(state: SettingsFormState): SettingsFormState {
  return {
    capacityAlertThreshold: state.capacityAlertThreshold,
    acceptedClasses: [...state.acceptedClasses],
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
  const [baseVersion, setBaseVersion] = React.useState<number>(1);
  const [errors, setErrors] = React.useState<SettingsFormErrors>({});
  const [isDirty, setIsDirty] = React.useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = React.useState<boolean>(false);

  // Initialize and preserve dirty draft across new snapshots:
  React.useEffect(() => {
    if (settingsQuery.data && (!draft || !isDirty)) {
      const ratesRecord: Record<ProgramMaterial, string> = {
        plastic: "0",
        aluminium: "0",
        paper: "0",
        glass: "0"
      };

      for (const r of settingsQuery.data.materialRates) {
        if (r.materialType in ratesRecord) {
          ratesRecord[r.materialType as ProgramMaterial] = String(
            r.pointsPerItem
          );
        }
      }

      const initialClasses = settingsQuery.data.acceptedClasses ?? [
        "plastic_bottle",
        "aluminium_can",
        "glass_bottle",
        "paper_item",
        "paper_bag",
      ];

      const initial: SettingsFormState = {
        capacityAlertThreshold: String(
          settingsQuery.data.capacityAlertThreshold
        ) as "75" | "80" | "85",
        acceptedClasses: [...initialClasses],
        rateInputs: ratesRecord
      };

      setDraft(initial);
      setSavedSnapshot(initial);
      setBaseVersion(settingsQuery.data.version ?? 1);
      setIsDirty(false);
    }
  }, [settingsQuery.data]);

  // Version conflict detection: dirty draft exists while background data has moved ahead
  const isVersionConflict = Boolean(
    isDirty &&
      settingsQuery.data?.version !== undefined &&
      settingsQuery.data.version > baseVersion
  );

  // Unconditional React Router blocker
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

  const handleToggleClass = (classId: string) => {
    if (!draft) return;
    if (classId === "cardboard_item") return; // strictly excluded

    const isAccepted = draft.acceptedClasses.includes(classId);
    const updated = isAccepted
      ? draft.acceptedClasses.filter((c) => c !== classId)
      : [...draft.acceptedClasses, classId];

    setDraft({ ...draft, acceptedClasses: updated });
    setIsDirty(true);
    setSaveSuccess(false);
    if (errors.acceptedClasses) {
      setErrors({ ...errors, acceptedClasses: undefined });
    }
  };

  const handleRateChange = (material: ProgramMaterial, value: string) => {
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

  // Reload latest settings from server, discarding conflicting local draft
  const handleReloadLatest = () => {
    if (!settingsQuery.data) return;
    saveMutation.clearError();
    setSaveSuccess(false);

    const ratesRecord: Record<ProgramMaterial, string> = {
      plastic: "0",
      aluminium: "0",
      paper: "0",
      glass: "0",
    };
    for (const r of settingsQuery.data.materialRates) {
      if (r.materialType in ratesRecord) {
        ratesRecord[r.materialType as ProgramMaterial] = String(r.pointsPerItem);
      }
    }

    const initialClasses = settingsQuery.data.acceptedClasses ?? [
      "plastic_bottle",
      "aluminium_can",
      "glass_bottle",
      "paper_item",
      "paper_bag",
    ];

    const initial: SettingsFormState = {
      capacityAlertThreshold: String(
        settingsQuery.data.capacityAlertThreshold
      ) as "75" | "80" | "85",
      acceptedClasses: [...initialClasses],
      rateInputs: ratesRecord,
    };

    setDraft(initial);
    setSavedSnapshot(initial);
    setBaseVersion(settingsQuery.data.version ?? 1);
    setIsDirty(false);
    setErrors({});
  };

  // Validation
  const validate = (): boolean => {
    if (!draft) return false;
    const newErrors: SettingsFormErrors = {};

    if (!draft.capacityAlertThreshold || !["75", "80", "85"].includes(draft.capacityAlertThreshold)) {
      newErrors.capacityAlertThreshold = "Valid threshold (75%, 80%, or 85%) is required";
    }

    if (draft.acceptedClasses.length === 0) {
      newErrors.acceptedClasses = "At least one accepted recyclable class must be selected";
    }

    if (draft.acceptedClasses.includes("cardboard_item")) {
      newErrors.acceptedClasses = "Cardboard cannot be accepted in smart bin automated deposits";
    }

    for (const m of ALL_PROGRAM_MATERIALS) {
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

    // Derive acceptedMaterials from explicit acceptedClasses
    const derivedAcceptedMaterials: MaterialType[] = [];
    if (draft.acceptedClasses.includes("plastic_bottle")) derivedAcceptedMaterials.push("plastic");
    if (draft.acceptedClasses.includes("aluminium_can")) derivedAcceptedMaterials.push("aluminium");
    if (draft.acceptedClasses.includes("glass_bottle")) derivedAcceptedMaterials.push("glass");
    if (draft.acceptedClasses.includes("paper_item") || draft.acceptedClasses.includes("paper_bag")) {
      derivedAcceptedMaterials.push("paper");
    }

    // Build MaterialRate list in repository order
    const materialRates: MaterialRate[] = (settingsQuery.data?.materialRates ?? []).map(
      (mr) => {
        const key = mr.materialType as ProgramMaterial;
        const pts = Number(draft.rateInputs[key] ?? 0);
        const isEligible = derivedAcceptedMaterials.includes(mr.materialType);
        return {
          materialType: mr.materialType,
          displayName: mr.displayName,
          pointsPerItem: pts,
          eligible: isEligible
        };
      }
    );

    const input: SettingsInput = {
      expectedVersion: baseVersion,
      capacityAlertThreshold: Number(draft.capacityAlertThreshold) as 75 | 80 | 85,
      acceptedMaterials: derivedAcceptedMaterials,
      acceptedClasses: draft.acceptedClasses,
      materialRates
    };

    const result = await saveMutation.run(() =>
      services.repositories.settings.update(input)
    );

    if (result) {
      const newSnapshot: SettingsFormState = {
        capacityAlertThreshold: String(result.capacityAlertThreshold) as "75" | "80" | "85",
        acceptedClasses: [...(result.acceptedClasses ?? draft.acceptedClasses)],
        rateInputs: { ...draft.rateInputs }
      };
      setSavedSnapshot(newSnapshot);
      setBaseVersion(result.version ?? baseVersion + 1);
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
          description="Fetching alert thresholds, accepted class policies, and points rates."
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

  // Derive which categories are currently active in the draft
  const activeCategories: ProgramMaterial[] = [];
  if (draft.acceptedClasses.includes("plastic_bottle")) activeCategories.push("plastic");
  if (draft.acceptedClasses.includes("aluminium_can")) activeCategories.push("aluminium");
  if (draft.acceptedClasses.includes("glass_bottle")) activeCategories.push("glass");
  if (draft.acceptedClasses.includes("paper_item") || draft.acceptedClasses.includes("paper_bag")) {
    activeCategories.push("paper");
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
              disabled={!isDirty || isVersionConflict}
              onClick={handleSave}
            >
              <Icon name="check" size={16} /> Save settings
            </Button>
          </div>
        }
      />

      {/* Program Policy and Operational Version Bar */}
      <div className="settings-policy-bar">
        <div className="settings-policy-pill">
          <span>Settings Version:</span>
          <code>v{settingsQuery.data?.version ?? baseVersion}</code>
        </div>
        <div className="settings-policy-pill">
          <span>Active Policy ID:</span>
          <code>{settingsQuery.data?.policyVersion ?? "policy-v1"}</code>
        </div>
        {settingsQuery.data?.updatedAt && (
          <div style={{ color: "var(--muted)", fontSize: "12px", marginLeft: "auto" }}>
            Last published: {new Date(settingsQuery.data.updatedAt).toLocaleString()}
          </div>
        )}
      </div>

      {/* Version Conflict Warning Banner */}
      {isVersionConflict && (
        <div className="conflict-banner" role="alert">
          <div className="conflict-banner-content">
            <Icon name="alert" size={22} />
            <div>
              <b>Newer program settings version published (v{settingsQuery.data?.version})</b>
              <div>
                Another administrator published updated program settings. Your local draft has been kept,
                but you must reload before saving to prevent overwriting recent changes.
              </div>
            </div>
          </div>
          <Button variant="ghost" onClick={handleReloadLatest}>
            <Icon name="history" size={14} /> Reload latest settings
          </Button>
        </div>
      )}

      {/* Success Notification Banner */}
      {saveSuccess && (
        <div className="success-banner" role="status">
          <Icon name="check" size={20} />
          <div>
            <b>Settings and policy published</b>
            <span>New configuration rules and calculation rates are now active township-wide.</span>
          </div>
        </div>
      )}

      {/* Mutation Error Notification */}
      {saveMutation.error && (
        <Feedback kind="error" onDismiss={saveMutation.clearError}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
            <span>{saveMutation.error}</span>
            {saveMutation.error.includes("Stale settings version") && (
              <span style={{ marginLeft: "12px" }}>
                <Button variant="ghost" onClick={handleReloadLatest}>
                  Reload latest
                </Button>
              </span>
            )}
          </div>
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
              at or above this threshold. Threshold changes trigger an automated cycle reconciliation.
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

        {/* Section 2: Explicit Accepted Material Classes */}
        <section className="setting-section">
          <div className="setting-section-intro">
            <div className="icon-wrap">
              <Icon name="recycle" size={22} />
            </div>
            <h2>Accepted material classes</h2>
            <p>
              Configure granular item-class eligibility grouped by material stream.
              Cardboard is strictly excluded from smart bins and must be directed to regional drop-off centers.
            </p>
          </div>
          <div className="setting-controls">
            <div className="class-categories-stack">
              {PROGRAM_CLASS_GROUPS.map((group) => {
                const isGroupEligible = activeCategories.includes(group.category);
                return (
                  <div key={group.category} className="class-category-group">
                    <div className="class-category-header">
                      <span className="class-category-title">
                        {group.title}
                      </span>
                      <span
                        className={`class-category-badge ${
                          isGroupEligible ? "eligible" : "ineligible"
                        }`}
                      >
                        {isGroupEligible ? "Stream Active" : "Stream Inactive"}
                      </span>
                    </div>

                    <div className="class-options-grid">
                      {group.classes.map((cls) => {
                        const isChecked = draft.acceptedClasses.includes(cls.id);
                        const isExcluded = Boolean(cls.excluded);

                        return (
                          <label
                            key={cls.id}
                            className={`class-option-card ${
                              isChecked ? "selected" : ""
                            } ${isExcluded ? "disabled" : ""}`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked && !isExcluded}
                              disabled={isExcluded}
                              onChange={() => handleToggleClass(cls.id)}
                            />
                            <div className="class-option-info">
                              <span className="class-option-label">{cls.label}</span>
                              <span className="class-option-desc">{cls.description}</span>
                              {isExcluded && cls.exclusionReason && (
                                <span className="excluded-tag">
                                  <Icon name="alert" size={12} /> {cls.exclusionReason}
                                </span>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {errors.acceptedClasses && (
              <span className="form-error" role="alert">
                {errors.acceptedClasses}
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
              deposit sessions. Non-negative values including 0 are valid.
            </p>
          </div>
          <div className="setting-controls">
            <div className="rate-options">
              {ALL_PROGRAM_MATERIALS.map((mat) => {
                const isAccepted = activeCategories.includes(mat);
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
                          <small style={{ color: "var(--amber)" }}>No active classes (0 pts)</small>
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
                          mat,
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
