// =============================================================================
// CapacityAlertsPage.tsx — Fleet capacity alert tracking & collection workflow
// Phase 8 — Multi-step lifecycle: trigger → schedule → collect → resolve
// =============================================================================

import * as React from "react";
import { useSearchParams } from "react-router-dom";
import { services, useObservableQuery, useMutation } from "../../app/services.ts";
import type {
  CapacityAlertRow,
  AlertListQuery,
  AlertSortKey,
  AlertStatus,
  CollectionStatus
} from "../../contracts/admin.ts";
import {
  AdminPageHeader,
  Button,
  Badge,
  AsyncState,
  Feedback,
  Icon
} from "../../ui/primitives.tsx";
import { DataTable, type Column } from "../../ui/DataTable.tsx";
import {
  Pagination,
  parseAlertQuery,
  patchQuery
} from "../../ui/ListControls.tsx";
import { ConfirmDialog } from "../../ui/Modal.tsx";
import "./operations.css";

// ---------------------------------------------------------------------------
// 1. Local Formatters & Helpers
// ---------------------------------------------------------------------------

const COLLECTION_LABELS: Record<CollectionStatus, string> = {
  notScheduled: "Not Scheduled",
  pending: "Pending Collection",
  scheduled: "Collection Scheduled",
  collected: "Collected"
};

const dateTimeFormatter = new Intl.DateTimeFormat("en-MY", {
  timeZone: "Asia/Kuala_Lumpur",
  month: "short",
  day: "numeric",
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

// ---------------------------------------------------------------------------
// 2. Private AlertDetailPanel Component
// ---------------------------------------------------------------------------

interface AlertDetailPanelProps {
  alertId: string;
  onResolved: (id: string) => void;
  onClearSelection: () => void;
}

function AlertDetailPanel(props: AlertDetailPanelProps): React.ReactElement {
  const { alertId, onResolved, onClearSelection } = props;

  // Unconditional observation of the specific alert
  const detailQuery = useObservableQuery<CapacityAlertRow | null>(
    `alert:${alertId}`,
    () => services.repositories.alerts.watch(alertId)
  );

  const actionMutation = useMutation();
  const [showCollectConfirm, setShowCollectConfirm] = React.useState<boolean>(false);
  const [localFeedback, setLocalFeedback] = React.useState<string | null>(null);

  const row = detailQuery.data;

  // 1. Loading State
  if (detailQuery.loading && !row) {
    return (
      <section className="alert-detail panel">
        <AsyncState
          kind="loading"
          title="Loading alert details..."
          description={`Fetching lifecycle record for ${alertId}.`}
        />
      </section>
    );
  }

  // 2. Query Error State
  if (detailQuery.error && !row) {
    return (
      <section className="alert-detail panel">
        <AsyncState
          kind="error"
          title="Unable to load alert details"
          description={detailQuery.error}
          onRetry={detailQuery.reload}
        />
      </section>
    );
  }

  // 3. Not Found State (Recoverable with Clear selection)
  if (!row) {
    return (
      <section className="alert-detail panel">
        <div className="empty-panel" style={{ padding: "40px 20px" }}>
          <div className="empty-panel-icon">
            <Icon name="shield" size={32} />
          </div>
          <h2>Alert Not Found</h2>
          <p>
            No capacity alert record matching <code>{alertId}</code> could be located. It may
            have been cleared or invalidly referenced.
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

  const { alert, bin, operations } = row;
  const isResolved = alert.status === "resolved";
  const isCollected = operations.collectionStatus === "collected";
  const isScheduled = operations.collectionStatus === "scheduled";
  const isPendingOrNot =
    operations.collectionStatus === "pending" ||
    operations.collectionStatus === "notScheduled";

  // 5-step workflow computation:
  // Uses alert.thresholdPercent snapshot rather than hardcoded 85
  const step1Done =
    bin.capacityPercent >= alert.thresholdPercent || isCollected || isResolved;
  const step2Done = true; // Alert record exists
  const step3Done = isScheduled || isCollected || isResolved;
  const step4Done = isCollected || isResolved;
  const step5Done = isResolved;

  // Handlers
  const handleSchedule = async () => {
    setLocalFeedback(null);
    actionMutation.clearError();
    const result = await actionMutation.run(() =>
      services.repositories.alerts.schedule(alert.id)
    );
    if (result) {
      setLocalFeedback(`Collection dispatched for bin ${bin.id}.`);
    }
  };

  const handleOpenCollect = () => {
    actionMutation.clearError();
    setShowCollectConfirm(true);
  };

  const handleConfirmCollect = async () => {
    const result = await actionMutation.run(() =>
      services.repositories.alerts.collect(alert.id)
    );
    if (result) {
      setShowCollectConfirm(false);
      setLocalFeedback(`Bin ${bin.id} marked as collected and capacity reset to 10%.`);
    }
  };

  const handleResolve = async () => {
    setLocalFeedback(null);
    actionMutation.clearError();
    const result = await actionMutation.run(() =>
      services.repositories.alerts.resolve(alert.id)
    );
    if (result) {
      onResolved(alert.id);
    }
  };

  return (
    <section className={`alert-detail panel ${isResolved ? "resolved" : ""}`}>
      {localFeedback && (
        <Feedback kind="success" onDismiss={() => setLocalFeedback(null)}>
          {localFeedback}
        </Feedback>
      )}

      {actionMutation.error && (
        <Feedback kind="error" onDismiss={actionMutation.clearError}>
          {actionMutation.error}
        </Feedback>
      )}

      {/* Top Banner / Heading */}
      <div className="alert-detail-top">
        <span>
          <Icon name={isResolved ? "check" : "alert"} size={28} />
        </span>
        <div className="alert-detail-heading">
          <div>
            <Badge
              tone={
                isResolved
                  ? "green"
                  : isCollected
                    ? "amber"
                    : "red"
              }
            >
              {isResolved
                ? "Resolved"
                : isCollected
                  ? "Ready to resolve"
                  : "Critical · collection required"}
            </Badge>
          </div>
          <h2>
            {bin.id} · {bin.locationName}
          </h2>
          <p>{bin.locationDetail}</p>
        </div>
        <div className="capacity-big">
          <strong>{bin.capacityPercent}%</strong>
          <small>Current capacity</small>
        </div>
      </div>

      {/* 5-Step Workflow */}
      <div className="workflow" aria-label="Alert resolution lifecycle progress">
        <div className={`workflow-step ${step1Done ? "done" : ""}`}>
          <span className="workflow-step-num">1</span>
          <span>Reach {alert.thresholdPercent}%</span>
        </div>
        <div className={`workflow-step ${step2Done ? "done" : ""}`}>
          <span className="workflow-step-num">2</span>
          <span>Alert created</span>
        </div>
        <div className={`workflow-step ${step3Done ? "done" : ""}`}>
          <span className="workflow-step-num">3</span>
          <span>Schedule</span>
        </div>
        <div className={`workflow-step ${step4Done ? "done" : ""}`}>
          <span className="workflow-step-num">4</span>
          <span>Collect & reset</span>
        </div>
        <div className={`workflow-step ${step5Done ? "done" : ""}`}>
          <span className="workflow-step-num">5</span>
          <span>Resolve</span>
        </div>
      </div>

      {/* Operational Facts Grid */}
      <div className="alert-facts">
        <div>
          <span>Time triggered</span>
          <b>{formatDateTime(alert.triggeredAt)}</b>
        </div>
        <div>
          <span>Last capacity update</span>
          <b>{formatDateTime(bin.lastUpdatedAt)}</b>
        </div>
        <div>
          <span>Collection status</span>
          <div>
            <Badge
              tone={
                operations.collectionStatus === "collected"
                  ? "green"
                  : operations.collectionStatus === "scheduled"
                    ? "amber"
                    : "gray"
              }
            >
              {COLLECTION_LABELS[operations.collectionStatus]}
            </Badge>
          </div>
        </div>
        <div>
          <span>Alert threshold</span>
          <b>{alert.thresholdPercent}%</b>
        </div>
      </div>

      {/* Lifecycle Actions */}
      <div className="alert-actions">
        {!isResolved && isPendingOrNot && (
          <Button
            variant="primary"
            busy={actionMutation.pending}
            onClick={handleSchedule}
          >
            Schedule collection
          </Button>
        )}

        {!isResolved && isScheduled && (
          <Button
            variant="primary"
            busy={actionMutation.pending}
            onClick={handleOpenCollect}
          >
            <Icon name="check" size={16} /> Mark collected & reset bin
          </Button>
        )}

        {!isResolved && isCollected && (
          <Button
            variant="primary"
            busy={actionMutation.pending}
            onClick={handleResolve}
          >
            <Icon name="check" size={16} /> Resolve alert
          </Button>
        )}
      </div>

      {/* Resolution Confirmation Banner */}
      {isResolved && (
        <div className="resolution" role="status">
          <Icon name="check" size={20} />
          <span>
            Collection completed, capacity reset to 10%, and alert resolved at{" "}
            {formatDateTime(alert.resolvedAt)}.
          </span>
        </div>
      )}

      {/* Confirm Collection Dialog */}
      <ConfirmDialog
        open={showCollectConfirm}
        title="Confirm Bin Collection"
        description="Confirm collection for this smart bin? Marking this bin as collected will reset its current capacity to 10% and update township operations."
        confirmLabel="Mark collected & reset bin"
        variant="primary"
        busy={actionMutation.pending}
        error={actionMutation.error}
        onConfirm={handleConfirmCollect}
        onCancel={() => setShowCollectConfirm(false)}
      />
    </section>
  );
}

// ---------------------------------------------------------------------------
// 3. Main CapacityAlertsPage Component
// ---------------------------------------------------------------------------

export function CapacityAlertsPage(): React.ReactElement {
  const [searchParams, setSearchParams] = useSearchParams();
  const query: AlertListQuery = parseAlertQuery(searchParams);

  // Observable list query
  const listKey = `alerts:${searchParams.toString()}`;
  const listQuery = useObservableQuery(listKey, () =>
    services.repositories.alerts.watchList(query)
  );

  const simulateMutation = useMutation();
  const [pageFeedback, setPageFeedback] = React.useState<string | null>(null);

  // Read alertId from URL; if missing, fallback to first row in the visible list
  const urlAlertId = searchParams.get("alertId");
  const firstRowAlertId = listQuery.data?.items[0]?.alert.id ?? null;
  const selectedAlertId = urlAlertId || firstRowAlertId;

  // Active counts from list query or 0
  const activeCount = listQuery.data?.activeCount ?? 0;
  const resolvedCount = listQuery.data?.resolvedCount ?? 0;

  // Handlers
  const handleTabChange = (status: AlertStatus) => {
    setSearchParams(
      patchQuery(searchParams, {
        status,
        page: "1",
        alertId: null
      })
    );
  };

  const handleSimulate = async () => {
    setPageFeedback(null);
    simulateMutation.clearError();
    const result = await simulateMutation.run(() =>
      services.repositories.bins.simulateCapacity("BIN-004", 85)
    );
    if (result) {
      setPageFeedback("BIN-004 simulated to 85% capacity. Critical alert triggered.");
    }
  };

  const handleAlertResolved = (id: string) => {
    // "on success set URL status resolved and alertId in the same patch."
    setSearchParams(
      patchQuery(searchParams, {
        status: "resolved",
        alertId: id,
        page: "1"
      })
    );
  };

  const handleClearSelection = () => {
    setSearchParams(
      patchQuery(searchParams, {
        alertId: null
      })
    );
  };

  const handleSortChange = (sort: { key: AlertSortKey; direction: "asc" | "desc" }) => {
    setSearchParams(
      patchQuery(searchParams, {
        sort: sort.key,
        direction: sort.direction,
        page: "1"
      })
    );
  };

  const handlePageChange = (nextPage: number) => {
    setSearchParams(patchQuery(searchParams, { page: String(nextPage) }));
  };

  const handlePageSizeChange = (nextSize: number) => {
    setSearchParams(patchQuery(searchParams, { pageSize: String(nextSize), page: "1" }));
  };

  // Table Columns
  const columns: Column<CapacityAlertRow, AlertSortKey>[] = [
    {
      id: "id",
      header: "Alert ID",
      cell: (row) => (
        <span style={{ fontWeight: 700, fontFamily: "var(--font-mono, monospace)" }}>
          {row.alert.id}
        </span>
      )
    },
    {
      id: "bin",
      header: "Smart Bin & Location",
      cell: (row) => (
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <b>{row.bin.id}</b>
          <small style={{ color: "var(--muted)", fontSize: "12px" }}>
            {row.bin.locationName}
          </small>
        </div>
      )
    },
    {
      id: "capacity",
      header: "Capacity",
      sortKey: "capacityPercent",
      cell: (row) => {
        const fill = row.bin.capacityPercent;
        const toneClass = fill >= 85 ? "critical" : fill >= 75 ? "warning" : "normal";
        return (
          <div className="capacity" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              style={{
                width: "80px",
                height: "6px",
                background: "var(--line)",
                borderRadius: "999px",
                overflow: "hidden",
                display: "inline-block"
              }}
            >
              <i
                className={toneClass}
                style={{
                  display: "block",
                  height: "100%",
                  width: `${Math.min(fill, 100)}%`,
                  background:
                    toneClass === "critical"
                      ? "var(--red)"
                      : toneClass === "warning"
                        ? "var(--amber)"
                        : "var(--green)",
                  borderRadius: "999px"
                }}
              />
            </span>
            <b>{fill}%</b>
          </div>
        );
      }
    },
    {
      id: "triggeredAt",
      header: "Triggered Time",
      sortKey: "triggeredAt",
      cell: (row) => <span>{formatDateTime(row.alert.triggeredAt)}</span>
    },
    {
      id: "collectionStatus",
      header: "Collection Status",
      cell: (row) => {
        const cs = row.operations.collectionStatus;
        return (
          <Badge
            tone={
              cs === "collected"
                ? "green"
                : cs === "scheduled"
                  ? "amber"
                  : "gray"
            }
          >
            {COLLECTION_LABELS[cs]}
          </Badge>
        );
      }
    },
    {
      id: "actions",
      header: "Action",
      cell: (row) => {
        const isSelected = row.alert.id === selectedAlertId;
        return (
          <button
            type="button"
            className={`btn btn-sm ${isSelected ? "primary" : "secondary"}`}
            onClick={() =>
              setSearchParams(patchQuery(searchParams, { alertId: row.alert.id }))
            }
          >
            {isSelected ? "Viewing" : "View"}
          </button>
        );
      }
    }
  ];

  const rows = listQuery.data?.items ?? [];
  const hasRows = rows.length > 0;

  return (
    <div className="alerts-layout">
      {/* Page Header with Action */}
      <AdminPageHeader
        eyebrow="PRIORITY WORKFLOW"
        title="Capacity alerts"
        description="Monitor automated threshold alerts, schedule collection runs, and verify bin reset workflows."
        actions={
          services.mode !== "firebase" ? (
            <Button
              variant="primary"
              busy={simulateMutation.pending}
              onClick={handleSimulate}
            >
              <Icon name="plus" size={16} /> Simulate BIN-004 to 85%
            </Button>
          ) : undefined
        }
      />

      {pageFeedback && (
        <Feedback kind="success" onDismiss={() => setPageFeedback(null)}>
          {pageFeedback}
        </Feedback>
      )}

      {simulateMutation.error && (
        <Feedback kind="error" onDismiss={simulateMutation.clearError}>
          {simulateMutation.error}
        </Feedback>
      )}

      {/* Tabs */}
      <div className="tabs" role="tablist" aria-label="Alert status queue">
        <button
          type="button"
          role="tab"
          aria-selected={query.status === "active"}
          className={query.status === "active" ? "active" : ""}
          onClick={() => handleTabChange("active")}
        >
          <span>Active alerts</span>
          <span className="tab-badge">{activeCount}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={query.status === "resolved"}
          className={query.status === "resolved" ? "active" : ""}
          onClick={() => handleTabChange("resolved")}
        >
          <span>Resolved</span>
          <span className="tab-badge">{resolvedCount}</span>
        </button>
      </div>

      {/* Detail Panel or Empty State */}
      {selectedAlertId ? (
        <AlertDetailPanel
          key={selectedAlertId}
          alertId={selectedAlertId}
          onResolved={handleAlertResolved}
          onClearSelection={handleClearSelection}
        />
      ) : (
        <section className="empty-panel panel">
          <div className="empty-panel-icon">
            <Icon name="shield" size={32} />
          </div>
          <h2>
            {query.status === "resolved" ? "No resolved alerts" : "No critical alerts"}
          </h2>
          <p>
            {query.status === "resolved"
              ? "Resolved collection alerts will appear here once collections are completed."
              : "All smart bins are operating within normal capacity thresholds. Simulate 85% capacity to demonstrate the operational workflow."}
          </p>
          {query.status === "active" && services.mode !== "firebase" && (
            <div style={{ marginTop: "12px" }}>
              <Button
                variant="primary"
                busy={simulateMutation.pending}
                onClick={handleSimulate}
              >
                Simulate 85% capacity
              </Button>
            </div>
          )}
        </section>
      )}

      {/* Alerts Table Section */}
      {hasRows && (
        <section className="alerts-table-section">
          <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 12px 0" }}>
            {query.status === "active" ? "Active Alert Queue" : "Resolved Alert History"}
          </h3>
          <DataTable
            caption="Capacity Alerts Queue"
            rows={rows}
            columns={columns}
            getRowId={(r) => r.alert.id}
            sort={query.sort}
            onSortChange={handleSortChange}
            loading={listQuery.loading}
            error={listQuery.error}
            onRetry={listQuery.reload}
            emptyTitle="No alerts in this view"
          />

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
      )}

      {/* Simulation note */}
      <p className="simulation-note">
        <Icon name="alert" size={18} />
        <span>
          Capacity sensors and collection operations are simulated for this prototype.
          Duplicate active alerts for the same smart bin are prevented.
        </span>
      </p>
    </div>
  );
}
