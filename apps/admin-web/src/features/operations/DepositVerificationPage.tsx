// =============================================================================
// DepositVerificationPage.tsx — Deposit AI review queue & verification decisions
// Phase 8 — Multi-state queue, detail inspection, idempotent decisions & receipts
// =============================================================================

import * as React from "react";
import { useSearchParams } from "react-router-dom";
import { services, useObservableQuery, useMutation } from "../../app/services.ts";
import type {
  VerificationDetail,
  VerificationListQuery,
  VerificationStatus,
  VerificationDecisionResult
} from "../../contracts/admin.ts";
import {
  AdminPageHeader,
  Button,
  Badge,
  AsyncState,
  Feedback,
  Icon
} from "../../ui/primitives.tsx";
import {
  SearchFilterBar,
  Pagination,
  parseVerificationQuery,
  patchQuery
} from "../../ui/ListControls.tsx";
import { ConfirmDialog } from "../../ui/Modal.tsx";
import "./operations.css";

// ---------------------------------------------------------------------------
// 1. Local Formatters & Helpers
// ---------------------------------------------------------------------------

const dateTimeFormatter = new Intl.DateTimeFormat("en-MY", {
  timeZone: "Asia/Kuala_Lumpur",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true
});

const timeFormatter = new Intl.DateTimeFormat("en-MY", {
  timeZone: "Asia/Kuala_Lumpur",
  hour: "numeric",
  minute: "2-digit",
  hour12: true
});

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    let clean = iso;
    if (typeof clean === "string" && clean.startsWith("Timestamp(")) {
      const m = clean.match(/seconds=(\d+)/);
      if (m) clean = new Date(Number(m[1]) * 1000).toISOString();
    }
    const d = new Date(clean);
    if (isNaN(d.getTime())) return iso;
    return dateTimeFormatter.format(d);
  } catch {
    return iso;
  }
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    let clean = iso;
    if (typeof clean === "string" && clean.startsWith("Timestamp(")) {
      const m = clean.match(/seconds=(\d+)/);
      if (m) clean = new Date(Number(m[1]) * 1000).toISOString();
    }
    const d = new Date(clean);
    if (isNaN(d.getTime())) return iso;
    return timeFormatter.format(d);
  } catch {
    return iso;
  }
}

import type {
  AdminReviewDetailView,
  ObjectResolutionDecisionInput,
  ReviewResolutionPreview,
  ResolveReviewInput,
} from "../../contracts/adminViewCodecs.ts";

function maskResidentId(id: string): string {
  if (!id) return "—";
  if (id.startsWith("Resident ")) return id;
  const parts = id.split("-");
  if (parts.length === 2) {
    const num = parts[1];
    const tail = num.slice(-3);
    return `${parts[0]}-•••${tail}`;
  }
  if (id.length > 6) {
    return `${id.slice(0, 3)}•••${id.slice(-3)}`;
  }
  return id;
}

const CANONICAL_CLASSES: Array<{ value: string; label: string; eligible: boolean }> = [
  { value: "plastic_bottle", label: "Plastic Bottle", eligible: true },
  { value: "aluminium_can", label: "Aluminium Can", eligible: true },
  { value: "glass_bottle", label: "Glass Bottle", eligible: true },
  { value: "paper_item", label: "Paper Item", eligible: true },
  { value: "paper_bag", label: "Paper Bag", eligible: true },
  { value: "cardboard_item", label: "Cardboard (Excluded)", eligible: false },
  { value: "other", label: "Other / Contaminant", eligible: false },
];

// ---------------------------------------------------------------------------
// 2. Private VerificationDetailPanel Component
// ---------------------------------------------------------------------------

interface VerificationDetailPanelProps {
  ticketId: string;
  onClearSelection: () => void;
  onDecisionResult?: (result: VerificationDecisionResult) => void;
}

function VerificationDetailPanel(props: VerificationDetailPanelProps): React.ReactElement {
  const { ticketId, onClearSelection } = props;

  // Observation of selected ticket & review detail
  const detailQuery = useObservableQuery<VerificationDetail | null>(
    `verification:${ticketId}`,
    () => services.repositories.verification.watch(ticketId)
  );

  const reviewDetailQuery = useObservableQuery<AdminReviewDetailView | null>(
    `reviewDetail:${ticketId}`,
    () => {
      if (services.repositories.verification.watchReviewDetail) {
        return services.repositories.verification.watchReviewDetail(ticketId);
      }
      return {
        subscribe: (observer) => {
          return services.repositories.verification.watch(ticketId).subscribe({
            next: () => {
              if (services.repositories.verification.getReviewDetail) {
                services.repositories.verification
                  .getReviewDetail(ticketId)
                  .then(observer.next)
                  .catch(observer.error);
              }
            },
            error: observer.error,
          });
        },
      };
    }
  );

  // Private resolution editor UI state
  const [inventoryState, setInventoryState] = React.useState<"resolved" | "empty" | "unreadable">("resolved");
  const [objectDecisions, setObjectDecisions] = React.useState<ObjectResolutionDecisionInput[]>([]);
  const [explanation, setExplanation] = React.useState<string>("Verified by operator review.");
  const [preview, setPreview] = React.useState<ReviewResolutionPreview | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = React.useState<boolean>(false);
  const [confirmModalOpen, setConfirmModalOpen] = React.useState<boolean>(false);
  const [confirmAction, setConfirmAction] = React.useState<"resolve" | "quickApprove" | "quickReject">("resolve");
  const [lastReceipt, setLastReceipt] = React.useState<VerificationDecisionResult | null>(null);

  const decideMutation = useMutation();
  const detail = detailQuery.data;
  const reviewDetail = reviewDetailQuery.data;

  // Synchronize decisions when review findings load
  React.useEffect(() => {
    if (reviewDetail?.findings && reviewDetail.findings.length > 0) {
      setObjectDecisions(
        reviewDetail.findings.map((f) => ({
          objectId: f.objectId,
          resolvedClass: f.resolvedClass ?? f.detectedClass,
          decision: f.decision ?? (f.detectedClass === "cardboard_item" ? "exclude" : "accept"),
          note: f.note ?? "",
        }))
      );
    } else if (detail) {
      setObjectDecisions([
        {
          objectId: "obj-1",
          resolvedClass: detail.transaction.materialType === "aluminium" ? "aluminium_can" : "plastic_bottle",
          decision: "accept",
          note: "",
        },
      ]);
    }
  }, [reviewDetail?.review.ticketId, reviewDetail?.review.decisionVersion, detail?.ticket.id]);

  const isFinalized = detail?.ticket.status !== "awaitingReview";

  // Server-computed live resolution preview
  React.useEffect(() => {
    if (!detail || isFinalized) return;
    let active = true;
    setIsPreviewLoading(true);

    if (services.repositories.verification.previewResolution) {
      services.repositories.verification
        .previewResolution({
          ticketId,
          inventoryState,
          objects: objectDecisions,
        })
        .then((res) => {
          if (active) {
            setPreview(res);
            setIsPreviewLoading(false);
          }
        })
        .catch(() => {
          if (active) setIsPreviewLoading(false);
        });
    } else {
      setIsPreviewLoading(false);
    }

    return () => {
      active = false;
    };
  }, [ticketId, inventoryState, objectDecisions, isFinalized, detail?.ticket.status]);

  // Loading State
  if (detailQuery.loading && !detail) {
    return (
      <section className="panel review-detail">
        <AsyncState
          kind="loading"
          title="Loading verification detail..."
          description={`Fetching AI detection snapshot for ${ticketId}.`}
        />
      </section>
    );
  }

  // Error State
  if (detailQuery.error && !detail) {
    return (
      <section className="panel review-detail">
        <AsyncState
          kind="error"
          title="Unable to load verification ticket"
          description={detailQuery.error}
          onRetry={detailQuery.reload}
        />
      </section>
    );
  }

  // Not Found State
  if (!detail) {
    return (
      <section className="panel review-detail">
        <div className="empty-panel" style={{ padding: "40px 20px" }}>
          <div className="empty-panel-icon">
            <Icon name="shield" size={32} />
          </div>
          <h2>Ticket Not Found</h2>
          <p>
            No verification ticket matching <code>{ticketId}</code> could be located.
          </p>
          <div style={{ marginTop: "12px" }}>
            <Button variant="secondary" onClick={onClearSelection}>
              Clear selection
            </Button>
          </div>
        </div>
      </section>
    );
  }

  const { ticket, transaction, resident, bin } = detail;

  // Derive points status strictly from transaction
  let pointsStatusText = "On hold · no points issued";
  if (transaction.status === "verified") {
    pointsStatusText = `${transaction.pointsAwarded ?? 0} points credited`;
  } else if (transaction.status === "rejected") {
    pointsStatusText = "Not eligible";
  }

  // Object decision changes
  const handleClassChange = (objectId: string, newClass: string) => {
    const isCardboard = newClass === "cardboard_item";
    setObjectDecisions((prev) =>
      prev.map((o) =>
        o.objectId === objectId
          ? {
            ...o,
            resolvedClass: newClass,
            decision: isCardboard ? "exclude" : o.decision,
          }
          : o
      )
    );
  };

  const handleDecisionToggle = (objectId: string, decision: "accept" | "exclude") => {
    setObjectDecisions((prev) =>
      prev.map((o) => (o.objectId === objectId ? { ...o, decision } : o))
    );
  };

  const handleOpenResolveDialog = (action: "resolve" | "quickApprove" | "quickReject") => {
    decideMutation.clearError();
    setConfirmAction(action);
    setConfirmModalOpen(true);
  };

  const handleConfirmDecision = async () => {
    const result = await decideMutation.run(async () => {
      let finalInventoryState = inventoryState;
      let finalObjects = objectDecisions;
      let finalExplanation = explanation.trim() || `Resolved as ${inventoryState} by operator.`;

      if (confirmAction === "quickApprove") {
        finalInventoryState = "resolved";
        finalObjects = objectDecisions.map((o) => ({
          ...o,
          decision: o.resolvedClass === "cardboard_item" ? "exclude" : "accept",
        }));
        finalExplanation = "Quick approved all eligible items by operator.";
      } else if (confirmAction === "quickReject") {
        finalInventoryState = "resolved";
        finalObjects = objectDecisions.map((o) => ({
          ...o,
          decision: "exclude",
        }));
        finalExplanation = "Rejected all items by operator review.";
      }

      const expectedVersion = reviewDetail?.review.decisionVersion ?? 1;

      if (services.repositories.verification.resolveReview) {
        const input: ResolveReviewInput = {
          ticketId,
          expectedDecisionVersion: expectedVersion,
          inventoryState: finalInventoryState,
          objects: finalObjects,
          explanation: finalExplanation,
        };
        return await services.repositories.verification.resolveReview(input);
      } else {
        const isApproved =
          finalInventoryState === "resolved" &&
          finalObjects.some((o) => o.decision === "accept");
        return await services.repositories.verification.decide(
          ticketId,
          isApproved ? "approve" : "reject",
          crypto.randomUUID()
        );
      }
    });

    if (result) {
      setLastReceipt(result);
      props.onDecisionResult?.(result);
      setConfirmModalOpen(false);
    }
  };

  const residentDisplayAlias =
    reviewDetail?.review.residentAlias ?? resident.fullName ?? maskResidentId(resident.id);

  return (
    <section className="panel review-detail">
      {decideMutation.error && (
        <Feedback kind="error" onDismiss={decideMutation.clearError}>
          {decideMutation.error}
        </Feedback>
      )}

      {/* Decision Receipt Banner */}
      {lastReceipt && lastReceipt.detail.ticket.id === ticket.id && (
        <div
          className={`decision-receipt-banner ${lastReceipt.detail.ticket.status === "approved" ? "approved" : "rejected"
            }`}
          role="status"
        >
          <Icon
            name={lastReceipt.detail.ticket.status === "approved" ? "check" : "alert"}
            size={18}
          />
          <span>
            {lastReceipt.detail.ticket.status === "approved"
              ? `Deposit ${lastReceipt.detail.transaction.id} verified! +${lastReceipt.detail.transaction.pointsAwarded ?? 0
              } EcoPoints credited to ${residentDisplayAlias}.`
              : `Deposit ${lastReceipt.detail.transaction.id} resolved as ${lastReceipt.detail.transaction.status}. 0 points credited to ${residentDisplayAlias}.`}
          </span>
        </div>
      )}

      {/* Camera Capture Shot / Simulation Placeholder */}
      <div className="camera-shot">
        {ticket.captureImageUrl ? (
          <img src={ticket.captureImageUrl} alt={ticket.captureDescription} />
        ) : (
          <>
            <Icon name="camera" size={48} />
            <b>Captured item: {ticket.captureDescription}</b>
            <span>Simulated bin capture</span>
          </>
        )}
        <span className="camera-shot-tag">Simulated bin capture</span>
      </div>

      {/* Review Heading */}
      <div className="review-heading">
        <div>
          <p className="eyebrow">DEPOSIT {transaction.id}</p>
          <h2>AI classification review</h2>
          <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--muted)" }}>
            Recorded at {bin.id} ({bin.locationName}) · {formatDateTime(transaction.occurredAt)}
          </p>
        </div>
        <div>
          <Badge
            tone={
              ticket.status === "approved"
                ? "green"
                : ticket.status === "rejected"
                  ? "red"
                  : "amber"
            }
          >
            {ticket.status === "approved"
              ? "Approved"
              : ticket.status === "rejected"
                ? "Rejected"
                : "Awaiting review"}
          </Badge>
        </div>
      </div>

      {/* 4-Box Classification Grid */}
      <div className="classification">
        <div>
          <span>Predicted material</span>
          <b>{ticket.predictedMaterialLabel}</b>
        </div>
        <div>
          <span>Pinned policy</span>
          <strong>{reviewDetail?.pinnedPolicyId ? `v${reviewDetail.pinnedPolicyVersion}` : "v1.0"}</strong>
        </div>
        <div>
          <span>Resident reference</span>
          <b>{residentDisplayAlias}</b>
        </div>
        <div>
          <span>Points status</span>
          <b>{pointsStatusText}</b>
        </div>
      </div>

      {/* Finalized Decision Metadata */}
      {isFinalized && (
        <div className="decision-meta">
          <Icon name="shield" size={16} />
          <span>
            Reviewed by <b>{ticket.reviewedByAdminId ?? reviewDetail?.review.reviewerAlias ?? "Admin"}</b> on{" "}
            {formatDateTime(ticket.reviewedAt)}.
          </span>
        </div>
      )}

      {/* AB-07 Multi-Object Resolution Editor (when awaiting review) */}
      {!isFinalized && (
        <div className="resolution-editor">
          <div className="resolution-editor-title">
            <h3>Chamber Inventory & Decisions</h3>
            <span style={{ fontSize: "11px", color: "var(--muted)" }}>
              {reviewDetail?.provisionalSpaceSpc ?? 30} spc provisional hold
            </span>
          </div>

          {/* Inventory State Selector */}
          <div>
            <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
              Inventory status
            </label>
            <div className="inventory-state-pills" role="radiogroup" aria-label="Inventory status">
              <button
                type="button"
                className={`inventory-state-pill ${inventoryState === "resolved" ? "active" : ""}`}
                onClick={() => setInventoryState("resolved")}
              >
                Items Present
              </button>
              <button
                type="button"
                className={`inventory-state-pill empty ${inventoryState === "empty" ? "active empty" : ""}`}
                onClick={() => setInventoryState("empty")}
              >
                Affirmative Empty
              </button>
              <button
                type="button"
                className={`inventory-state-pill unreadable ${inventoryState === "unreadable" ? "active unreadable" : ""}`}
                onClick={() => setInventoryState("unreadable")}
              >
                Technical / Unreadable
              </button>
            </div>
          </div>

          {/* Per-Object Findings List (if items present) */}
          {inventoryState === "resolved" && (
            <div className="findings-list">
              {objectDecisions.map((obj, idx) => {
                const detectedFinding = reviewDetail?.findings.find((f) => f.objectId === obj.objectId);
                const confPercent = detectedFinding?.confidence
                  ? Math.round(detectedFinding.confidence * 100)
                  : ticket.confidencePercent;

                return (
                  <div key={obj.objectId} className="finding-card">
                    <div className="finding-info">
                      <strong>Object #{idx + 1}</strong>
                      <small>
                        Detected: {detectedFinding?.detectedClass ?? "item"} · {confPercent}%
                      </small>
                    </div>

                    <div className="finding-controls">
                      <select
                        aria-label={`Resolved class for object ${idx + 1}`}
                        className="class-select"
                        value={obj.resolvedClass}
                        onChange={(e) => handleClassChange(obj.objectId, e.target.value)}
                      >
                        {CANONICAL_CLASSES.map((cls) => (
                          <option key={cls.value} value={cls.value}>
                            {cls.label}
                          </option>
                        ))}
                      </select>

                      <div className="decision-toggle-group" role="group" aria-label={`Decision for object ${idx + 1}`}>
                        <button
                          type="button"
                          className={`decision-toggle-btn accept ${obj.decision === "accept" ? "active" : ""}`}
                          onClick={() => handleDecisionToggle(obj.objectId, "accept")}
                          disabled={obj.resolvedClass === "cardboard_item"}
                          title={obj.resolvedClass === "cardboard_item" ? "Cardboard is excluded by policy" : "Accept item"}
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          className={`decision-toggle-btn exclude ${obj.decision === "exclude" ? "active" : ""}`}
                          onClick={() => handleDecisionToggle(obj.objectId, "exclude")}
                        >
                          Exclude
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Live Server-Computed Preview Card */}
          {preview && (
            <div className={`resolution-preview-card ${preview.outcome}`}>
              <div className="preview-stats">
                <div className="preview-stat">
                  <span>Outcome</span>
                  <strong>{preview.outcome.toUpperCase()}</strong>
                </div>
                <div className="preview-stat">
                  <span>Points</span>
                  <strong>+{preview.pointsAwarded} pts</strong>
                </div>
                <div className="preview-stat">
                  <span>Accepted</span>
                  <strong>{preview.acceptedCount} items</strong>
                </div>
                <div className="preview-stat">
                  <span>Capacity delta</span>
                  <strong>
                    {preview.spaceDeltaSpc > 0 ? `+${preview.spaceDeltaSpc}` : preview.spaceDeltaSpc} spc
                  </strong>
                </div>
              </div>
              {isPreviewLoading && <small style={{ color: "var(--muted)" }}>Updating preview…</small>}
            </div>
          )}

          {/* Explanation Textarea */}
          <div className="explanation-field">
            <label htmlFor="review-explanation">Resolution note / explanation</label>
            <textarea
              id="review-explanation"
              rows={2}
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="State reason for resolution decisions..."
            />
          </div>
        </div>
      )}

      {/* Review Actions */}
      <div className="decision-actions">
        {isFinalized ? (
          <>
            <Button variant="danger" disabled>
              Reject deposit
            </Button>
            <Button variant="primary" disabled>
              <Icon name="check" size={16} /> Approve deposit
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="secondary"
              busy={decideMutation.pending}
              onClick={() => handleOpenResolveDialog("quickReject")}
            >
              Quick Reject
            </Button>
            <Button
              variant="secondary"
              busy={decideMutation.pending}
              onClick={() => handleOpenResolveDialog("quickApprove")}
            >
              Quick Approve
            </Button>
            <Button
              variant="primary"
              busy={decideMutation.pending}
              onClick={() => handleOpenResolveDialog("resolve")}
            >
              <Icon name="check" size={16} /> Submit resolution
            </Button>
          </>
        )}
      </div>

      <p className="fine" style={{ margin: "4px 0 0", fontSize: "11px", color: "var(--muted)" }}>
        Uncertain deposits never receive EcoPoints automatically. Points and bin space corrections are
        issued only after an admin resolves the verification ticket.
      </p>

      {/* Decision Confirmation Dialog */}
      <ConfirmDialog
        open={confirmModalOpen}
        title={
          confirmAction === "quickApprove"
            ? "Quick Approve Deposit"
            : confirmAction === "quickReject"
              ? "Quick Reject Deposit"
              : "Confirm Batch Resolution"
        }
        description={
          confirmAction === "quickApprove"
            ? `Approve deposit ${transaction.id} and award EcoPoints for all eligible items to ${residentDisplayAlias}?`
            : confirmAction === "quickReject"
              ? `Reject deposit ${transaction.id}? No points will be credited to ${residentDisplayAlias}.`
              : `Submit resolution for ticket ${ticket.id} (${inventoryState}) with ${preview ? `+${preview.pointsAwarded} pts and ${preview.spaceContributionSpc} spc` : "calculated changes"
              }?`
        }
        confirmLabel={
          confirmAction === "quickApprove"
            ? "Approve deposit"
            : confirmAction === "quickReject"
              ? "Reject deposit"
              : "Confirm resolution"
        }
        variant={confirmAction === "quickReject" ? "danger" : "primary"}
        busy={decideMutation.pending}
        error={decideMutation.error}
        onConfirm={handleConfirmDecision}
        onCancel={() => setConfirmModalOpen(false)}
      />
    </section>
  );
}

// ---------------------------------------------------------------------------
// 3. Main DepositVerificationPage Component
// ---------------------------------------------------------------------------

export function DepositVerificationPage(): React.ReactElement {
  const [searchParams, setSearchParams] = useSearchParams();
  const query: VerificationListQuery = parseVerificationQuery(searchParams);
  const [lastReceipt, setLastReceipt] = React.useState<VerificationDecisionResult | null>(null);

  // Observable verification list query
  const listKey = `verification:${searchParams.toString()}`;
  const listQuery = useObservableQuery(listKey, () =>
    services.repositories.verification.watchList(query)
  );

  const urlTicketId = searchParams.get("ticketId");

  // Normalize selection:
  // 1. If list has items and no ticket is selected (or urlTicketId is not in items), pick the first item.
  // 2. If list is loaded and empty, clear ticketId from URL.
  React.useEffect(() => {
    if (!listQuery.data) return;

    if (listQuery.data.items.length === 0) {
      if (urlTicketId) {
        setSearchParams(patchQuery(searchParams, { ticketId: null }), { replace: true });
      }
    } else {
      const exists = listQuery.data.items.some((it) => it.ticket.id === urlTicketId);
      if (!urlTicketId || !exists) {
        const firstId = listQuery.data.items[0].ticket.id;
        setSearchParams(patchQuery(searchParams, { ticketId: firstId }), { replace: true });
      }
    }
  }, [urlTicketId, listQuery.data, searchParams, setSearchParams]);

  const items = listQuery.data?.items ?? [];
  const selectedTicketId = items.some((it) => it.ticket.id === urlTicketId)
    ? urlTicketId
    : null;

  // Handlers
  const handleTabChange = (status: VerificationStatus) => {
    setSearchParams(
      patchQuery(searchParams, {
        status,
        page: "1",
        ticketId: null
      })
    );
  };

  const handleSearchChange = (search: string) => {
    setSearchParams(patchQuery(searchParams, { search: search || null, page: "1" }));
  };

  const handleClearSelection = () => {
    setSearchParams(patchQuery(searchParams, { ticketId: null }));
  };

  const handlePageChange = (nextPage: number) => {
    setSearchParams(patchQuery(searchParams, { page: String(nextPage) }));
  };

  const handlePageSizeChange = (nextSize: number) => {
    setSearchParams(patchQuery(searchParams, { pageSize: String(nextSize), page: "1" }));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Header */}
      <AdminPageHeader
        eyebrow="AI REVIEW QUEUE"
        title="Deposit verification"
        description="Inspect camera captures and machine classification results for flagged recycling deposits."
      />

      {/* Queue Status Tabs */}
      <div className="tabs" role="tablist" aria-label="Deposit review queue tabs">
        <button
          type="button"
          role="tab"
          aria-selected={query.status === "awaitingReview"}
          className={query.status === "awaitingReview" ? "active" : ""}
          onClick={() => handleTabChange("awaitingReview")}
        >
          <span>Awaiting Review</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={query.status === "approved"}
          className={query.status === "approved" ? "active" : ""}
          onClick={() => handleTabChange("approved")}
        >
          <span>Approved</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={query.status === "rejected"}
          className={query.status === "rejected" ? "active" : ""}
          onClick={() => handleTabChange("rejected")}
        >
          <span>Rejected</span>
        </button>
      </div>

      {/* Decision Receipt Banner */}
      {lastReceipt && (
        <div className="receipt-banner" role="status">
          <Icon name="check" size={20} />
          <span>
            {(lastReceipt.outcome === "verified" || lastReceipt.detail.transaction.status === "verified")
              ? `Deposit ${lastReceipt.detail.transaction.id} approved! +${lastReceipt.pointsAwarded ?? lastReceipt.detail.transaction.pointsAwarded ?? 0} EcoPoints credited to ${lastReceipt.detail.resident.fullName ?? lastReceipt.detail.resident.id}.`
              : `Deposit ${lastReceipt.detail.transaction.id} resolved as ${lastReceipt.detail.transaction.status}. 0 points credited to ${lastReceipt.detail.resident.fullName ?? lastReceipt.detail.resident.id}.`}
          </span>
        </div>
      )}

      {/* Review Queue Layout: List on Left, Detail on Right */}
      <div className="review-layout">
        {/* Left: Queue List Panel */}
        <section className="review-list-panel">
          <div className="review-queue-header">
            <h2>Review queue</h2>
            <Badge tone="gray">
              {listQuery.data ? `${listQuery.data.total} tickets` : "Loading..."}
            </Badge>
          </div>

          <SearchFilterBar
            search={query.search}
            searchLabel="Search ticket, deposit, resident…"
            onSearchChange={handleSearchChange}
            filters={[]}
            onFilterChange={() => { }}
            onReset={() => handleSearchChange("")}
          />

          {listQuery.loading && !listQuery.data && (
            <div style={{ padding: "24px 0" }}>
              <AsyncState kind="loading" title="Loading queue..." />
            </div>
          )}

          {listQuery.error && !listQuery.data && (
            <div style={{ padding: "24px 0" }}>
              <AsyncState
                kind="error"
                title="Error loading queue"
                description={listQuery.error}
                onRetry={listQuery.reload}
              />
            </div>
          )}

          {items.length === 0 && !listQuery.loading && (
            <div className="empty-panel panel" style={{ padding: "36px 16px" }}>
              <div className="empty-panel-icon" style={{ width: "48px", height: "48px" }}>
                <Icon name="check" size={24} />
              </div>
              <h2 style={{ fontSize: "16px" }}>No tickets in queue</h2>
              <p style={{ fontSize: "12px" }}>
                {query.status === "awaitingReview"
                  ? "All flagged deposits have been reviewed and verified."
                  : `No deposits currently marked as ${query.status}.`}
              </p>
            </div>
          )}

          <div className="review-list" role="list" aria-label="Review tickets">
            {items.map((item) => {
              const isSelected = item.ticket.id === selectedTicketId;
              return (
                <button
                  type="button"
                  key={item.ticket.id}
                  className={`review-item-btn ${isSelected ? "active" : ""}`}
                  onClick={() =>
                    setSearchParams(
                      patchQuery(searchParams, { ticketId: item.ticket.id })
                    )
                  }
                  aria-current={isSelected ? "true" : undefined}
                >
                  <span className="capture-avatar">
                    {item.ticket.captureImageUrl ? (
                      <img
                        src={item.ticket.captureImageUrl}
                        alt={item.ticket.captureDescription}
                      />
                    ) : (
                      <Icon name="camera" size={24} />
                    )}
                  </span>
                  <div className="review-item-info">
                    <strong>{item.transaction.id}</strong>
                    <small>
                      {item.bin.id} · {formatTime(item.transaction.occurredAt)}
                    </small>
                    <div>
                      <Badge
                        tone={
                          item.ticket.flag === "possibleContaminant"
                            ? "red"
                            : "amber"
                        }
                      >
                        {item.ticket.flag === "possibleContaminant"
                          ? "Possible contaminant"
                          : "Uncertain"}
                      </Badge>
                    </div>
                  </div>
                  <b style={{ marginLeft: "auto", fontSize: "14px", color: "var(--text)" }}>
                    {item.ticket.confidencePercent}%
                  </b>
                </button>
              );
            })}
          </div>

          {listQuery.data && (
            <Pagination
              page={listQuery.data.page}
              pageSize={listQuery.data.pageSize}
              total={listQuery.data.total}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
            />
          )}
        </section>

        {/* Right: Selected Detail Panel */}
        {selectedTicketId ? (
          <VerificationDetailPanel
            key={selectedTicketId}
            ticketId={selectedTicketId}
            onClearSelection={handleClearSelection}
            onDecisionResult={setLastReceipt}
          />
        ) : (
          <section className="panel review-detail">
            <div className="empty-panel" style={{ padding: "48px 24px" }}>
              <div className="empty-panel-icon">
                <Icon name="camera" size={32} />
              </div>
              <h2>Select a Ticket to Review</h2>
              <p>
                Choose an item from the review queue on the left to inspect its captured image,
                classification confidence, and resident attribution.
              </p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
