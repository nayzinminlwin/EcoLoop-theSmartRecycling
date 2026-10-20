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
    return dateTimeFormatter.format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return timeFormatter.format(new Date(iso));
  } catch {
    return iso;
  }
}

function maskResidentId(id: string): string {
  const parts = id.split("-");
  if (parts.length === 2) {
    const num = parts[1];
    const tail = num.slice(-3);
    return `${parts[0]}-•••${tail}`;
  }
  return id;
}

// ---------------------------------------------------------------------------
// 2. Private VerificationDetailPanel Component
// ---------------------------------------------------------------------------

interface VerificationDetailPanelProps {
  ticketId: string;
  onClearSelection: () => void;
}

function VerificationDetailPanel(props: VerificationDetailPanelProps): React.ReactElement {
  const { ticketId, onClearSelection } = props;

  // Unconditional observation of selected ticket
  const detailQuery = useObservableQuery<VerificationDetail | null>(
    `verification:${ticketId}`,
    () => services.repositories.verification.watch(ticketId)
  );

  // Private UI state: decision and idempotencyKey
  const [decision, setDecision] = React.useState<"approve" | "reject" | null>(null);
  const [idempotencyKey, setIdempotencyKey] = React.useState<string | null>(null);
  const [lastReceipt, setLastReceipt] = React.useState<VerificationDecisionResult | null>(null);

  const decideMutation = useMutation();
  const detail = detailQuery.data;

  // 1. Loading State
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

  // 2. Query Error State
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

  // 3. Not Found State (Recoverable with Clear selection)
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
  const isFinalized = ticket.status !== "awaitingReview";

  // Derive points status strictly from transaction.status and transaction.pointsAwarded
  let pointsStatusText = "On hold · no points issued";
  if (transaction.status === "verified") {
    pointsStatusText = `${transaction.pointsAwarded ?? 0} points credited`;
  } else if (transaction.status === "rejected") {
    pointsStatusText = "Not eligible";
  }

  // Handlers for decision modal
  const handleOpenApprove = () => {
    decideMutation.clearError();
    setDecision("approve");
    // Generate UUID once; retain for retries
    setIdempotencyKey(crypto.randomUUID());
  };

  const handleOpenReject = () => {
    decideMutation.clearError();
    setDecision("reject");
    // Generate UUID once; retain for retries
    setIdempotencyKey(crypto.randomUUID());
  };

  const handleCancelDecision = () => {
    setDecision(null);
    setIdempotencyKey(null);
    decideMutation.clearError();
  };

  const handleConfirmDecision = async () => {
    if (!decision || !idempotencyKey) return;
    const result = await decideMutation.run(() =>
      services.repositories.verification.decide(ticket.id, decision, idempotencyKey)
    );
    if (result) {
      setLastReceipt(result);
      setDecision(null);
      setIdempotencyKey(null);
    }
  };

  return (
    <section className="panel review-detail">
      {decideMutation.error && (
        <Feedback kind="error" onDismiss={decideMutation.clearError}>
          {decideMutation.error}
        </Feedback>
      )}

      {/* Decision Receipt Banner (kept visible even after status leaves awaitingReview) */}
      {lastReceipt && lastReceipt.detail.ticket.id === ticket.id && (
        <div
          className={`decision-receipt-banner ${
            lastReceipt.detail.ticket.status === "approved" ? "approved" : "rejected"
          }`}
          role="status"
        >
          <Icon
            name={lastReceipt.detail.ticket.status === "approved" ? "check" : "alert"}
            size={18}
          />
          <span>
            {lastReceipt.detail.ticket.status === "approved"
              ? `Deposit ${lastReceipt.detail.transaction.id} approved! +${
                  lastReceipt.detail.transaction.pointsAwarded ?? 0
                } EcoPoints credited to ${lastReceipt.detail.resident.fullName} (New balance: ${
                  lastReceipt.wallet.balance
                } pts).`
              : `Deposit ${lastReceipt.detail.transaction.id} rejected. 0 points awarded to ${lastReceipt.detail.resident.fullName}.`}
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
            <span>Simulated internal camera capture</span>
          </>
        )}
        <span className="camera-shot-tag">
          {ticket.captureImageUrl ? "Physical camera capture" : "Simulated internal camera capture"}
        </span>
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
          <span>AI confidence</span>
          <strong>{ticket.confidencePercent}%</strong>
        </div>
        <div>
          <span>Resident reference</span>
          <b>{maskResidentId(resident.id)}</b>
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
            Reviewed by <b>{ticket.reviewedByAdminId ?? "ADM-001"}</b> on{" "}
            {formatDateTime(ticket.reviewedAt)}.
          </span>
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
              variant="danger"
              busy={decideMutation.pending}
              onClick={handleOpenReject}
            >
              Reject deposit
            </Button>
            <Button
              variant="primary"
              busy={decideMutation.pending}
              onClick={handleOpenApprove}
            >
              <Icon name="check" size={16} /> Approve deposit
            </Button>
          </>
        )}
      </div>

      <p className="fine" style={{ margin: "4px 0 0", fontSize: "11px", color: "var(--muted)" }}>
        Uncertain deposits never receive EcoPoints automatically. Points are issued only after an
        admin approves an eligible item.
      </p>

      {/* Decision Confirmation Dialog */}
      <ConfirmDialog
        open={decision !== null}
        title={decision === "approve" ? "Approve Deposit" : "Reject Deposit"}
        description={
          decision === "approve"
            ? `Approve deposit ${transaction.id} (${ticket.predictedMaterialLabel})? This will award points according to the active material rate and credit the resident's wallet.`
            : `Reject deposit ${transaction.id}? No points will be credited and the transaction will be closed as rejected.`
        }
        confirmLabel={decision === "approve" ? "Approve deposit" : "Reject deposit"}
        variant={decision === "approve" ? "primary" : "danger"}
        busy={decideMutation.pending}
        error={decideMutation.error}
        onConfirm={handleConfirmDecision}
        onCancel={handleCancelDecision}
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
            onFilterChange={() => {}}
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
