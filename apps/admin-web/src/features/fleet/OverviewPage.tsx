// =============================================================================
// OverviewPage.tsx — Admin fleet overview dashboard & live analytics
// Phase 7 — KPI metrics, weekly activity chart, material mix donut & attention bins
// =============================================================================

import * as React from "react";
import { NavLink } from "react-router-dom";
import { services, useObservableQuery } from "../../app/services.ts";
import type { DashboardSummary, SmartBinRow, CapacityBand, CollectionStatus } from "../../contracts/admin.ts";
import type { MaterialType } from "../../contracts/shared.ts";
import { AdminPageHeader, Button, Badge, AsyncState, Icon } from "../../ui/primitives.tsx";
import { DataTable, type Column } from "../../ui/DataTable.tsx";
import "./fleet.css";

// ---------------------------------------------------------------------------
// 1. Private Local Helpers
// ---------------------------------------------------------------------------

function formatPoints(value: number): string {
  return value.toLocaleString("en-MY") + " pts";
}

function formatWeight(value: number): string {
  return value.toFixed(2) + " kg";
}

function capacityBand(value: number): CapacityBand {
  if (value >= 85) return "critical";
  if (value >= 75) return "warning";
  return "normal";
}

const MATERIAL_COLORS: Record<MaterialType | string, string> = {
  plastic: "var(--green)",
  aluminium: "var(--amber)",
  paper: "#88a77f",
  glass: "var(--blue)"
};

const COLLECTION_LABELS: Record<CollectionStatus, string> = {
  notScheduled: "Not Scheduled",
  pending: "Pending Collection",
  scheduled: "Collection Scheduled",
  collected: "Collected"
};

const weekdayFormatter = new Intl.DateTimeFormat("en-MY", {
  timeZone: "Asia/Kuala_Lumpur",
  weekday: "short"
});

const DAY_ORDER: Record<string, number> = {
  mon: 0, monday: 0,
  tue: 1, tuesday: 1,
  wed: 2, wednesday: 2,
  thu: 3, thursday: 3,
  fri: 4, friday: 4,
  sat: 5, saturday: 5,
  sun: 6, sunday: 6
};

function getMondayToSundayIndex(dateStr: string): number {
  const lower = dateStr.toLowerCase().trim();
  for (const [key, idx] of Object.entries(DAY_ORDER)) {
    if (lower.startsWith(key)) return idx;
  }
  const dateObj = new Date(dateStr);
  if (!isNaN(dateObj.getTime())) {
    return (dateObj.getDay() + 6) % 7;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// 2. OverviewPage Component
// ---------------------------------------------------------------------------

export function OverviewPage(): React.ReactElement {
  const summaryQuery = useObservableQuery<DashboardSummary>("dashboard", () =>
    services.repositories.dashboard.watchSummary()
  );
  const summary = summaryQuery.data;

  if (summaryQuery.loading && !summary) {
    return (
      <div style={{ padding: "48px 0", textAlign: "center" }}>
        <AsyncState kind="loading" title="Loading fleet analytics..." description="Fetching latest dashboard metrics." />
      </div>
    );
  }

  if (summaryQuery.error && !summary) {
    return (
      <div style={{ padding: "48px 0" }}>
        <AsyncState
          kind="error"
          title="Unable to load dashboard"
          description={summaryQuery.error}
          onRetry={summaryQuery.reload}
        />
      </div>
    );
  }

  if (!summary) {
    return (
      <div style={{ padding: "48px 0" }}>
        <AsyncState kind="empty" title="No dashboard data available" />
      </div>
    );
  }

  // Attention table column definitions
  const attentionColumns: Column<SmartBinRow, "id" | "locationName" | "capacityPercent">[] = [
    {
      id: "id",
      header: "Bin ID",
      cell: (row) => <strong>{row.bin.id}</strong>
    },
    {
      id: "location",
      header: "Location",
      cell: (row) => (
        <div>
          <div>{row.bin.locationName}</div>
          <small style={{ color: "var(--muted)", fontSize: "11px" }}>{row.bin.locationDetail}</small>
        </div>
      )
    },
    {
      id: "capacity",
      header: "Capacity",
      cell: (row) => {
        const band = capacityBand(row.bin.capacityPercent);
        return (
          <div className="capacity">
            <span className="capacity-track">
              <i
                className={`capacity-fill ${band}`}
                style={{ width: `${Math.min(100, Math.max(0, row.bin.capacityPercent))}%` }}
              />
            </span>
            <span className={`capacity-value ${band}`}>{row.bin.capacityPercent}%</span>
          </div>
        );
      }
    },
    {
      id: "status",
      header: "Status",
      cell: (row) => {
        const band = capacityBand(row.bin.capacityPercent);
        const tone = band === "critical" ? "red" : band === "warning" ? "amber" : "green";
        return (
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <Badge tone={tone}>{band.toUpperCase()}</Badge>
            {row.bin.isOnline ? (
              <Badge tone="green">ONLINE</Badge>
            ) : (
              <Badge tone="gray">OFFLINE</Badge>
            )}
          </div>
        );
      }
    },
    {
      id: "collection",
      header: "Collection",
      cell: (row) => (
        <span style={{ fontSize: "12px", color: "var(--muted)" }}>
          {COLLECTION_LABELS[row.operations.collectionStatus]}
        </span>
      )
    }
  ];

  // Arrange weekly activity starting with Monday through Sunday (Mon -> Sun)
  const sortedActivity = React.useMemo(() => {
    if (!summary?.activity) return [];
    return [...summary.activity].sort((a, b) => {
      return getMondayToSundayIndex(a.date) - getMondayToSundayIndex(b.date);
    });
  }, [summary?.activity]);

  // Bar chart scale calculation
  const maxActivity = Math.max(
    1,
    ...sortedActivity.map((a) => a.verifiedDepositCount)
  );

  // Donut chart conic-gradient calculation
  let gradientStops = "#e5e9e4 0deg 360deg";
  if (summary.totalWeightKg > 0) {
    let accumulated = 0;
    const stops: string[] = [];
    for (const mix of summary.materialMix) {
      const percentage = (mix.weightKg / summary.totalWeightKg) * 100;
      const startDeg = (accumulated / 100) * 360;
      const endDeg = ((accumulated + percentage) / 100) * 360;
      const color = MATERIAL_COLORS[mix.materialType] || "var(--green)";
      stops.push(`${color} ${startDeg.toFixed(1)}deg ${endDeg.toFixed(1)}deg`);
      accumulated += percentage;
    }
    if (stops.length > 0) {
      gradientStops = stops.join(", ");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <AdminPageHeader
        eyebrow="ADMIN CONSOLE"
        title="Township Overview"
        description="Real-time smart bin statuses, collection alerts, weekly deposit trends, and material distribution."
      />


      {summary.activeAlerts > 0 && (
        <NavLink to="/alerts" className="alert-banner">
          <div className="alert-banner-icon">
            <Icon name="alert" size={20} />
          </div>
          <div className="alert-banner-content">
            <strong>Capacity Alert Triggered</strong>
            <p>
              {summary.activeAlerts === 1
                ? "1 smart bin has reached or exceeded critical capacity threshold."
                : `${summary.activeAlerts} smart bins have reached or exceeded critical capacity threshold.`}{" "}
              Click to view operational dispatch workflow.
            </p>
          </div>
          <Icon name="arrow" size={16} />
        </NavLink>
      )}

      {/* KPI Metric Cards */}
      <div className="metric-grid">
        <div className="metric">
          <div className="metric-icon">
            <Icon name="bin" size={20} />
          </div>
          <div className="metric-info">
            <small>Registered Bins</small>
            <strong>{summary.registeredBins}</strong>
            <p>Active in fleet</p>
          </div>
        </div>

        <div className="metric">
          <div className="metric-icon" style={{ background: "var(--amber-bg)", color: "var(--amber-text)" }}>
            <Icon name="alert" size={20} />
          </div>
          <div className="metric-info">
            <small>Active Alerts</small>
            <strong style={{ color: summary.activeAlerts > 0 ? "var(--red)" : "inherit" }}>
              {summary.activeAlerts}
            </strong>
            <p>{summary.activeAlerts > 0 ? "Requires pickup" : "All bins normal"}</p>
          </div>
        </div>

        <div className="metric">
          <div className="metric-icon">
            <Icon name="recycle" size={20} />
          </div>
          <div className="metric-info">
            <small>Verified Deposits</small>
            <strong>{summary.verifiedDeposits}</strong>
            <p>{formatWeight(summary.totalWeightKg)} total</p>
          </div>
        </div>

        <div className="metric">
          <div className="metric-icon" style={{ background: "var(--mint)", color: "var(--green)" }}>
            <Icon name="gift" size={20} />
          </div>
          <div className="metric-info">
            <small>EcoPoints Issued</small>
            <strong>{formatPoints(summary.ecoPointsIssued)}</strong>
            <p>Awarded to residents</p>
          </div>
        </div>
      </div>

      {/* Charts Layout */}
      <div className="dashboard-grid">
        {/* Weekly Activity Bar Chart */}
        <div className="panel">
          <div className="panel-head">
            <div>
              <h2>Weekly Verified Activity</h2>
              <p>Daily count of confirmed deposit transactions</p>
            </div>
            <Badge tone="green">7 Days</Badge>
          </div>

          <div className="chart">
            <div className="y-labels">
              <span>{maxActivity}</span>
              <span>{Math.round(maxActivity / 2)}</span>
              <span>0</span>
            </div>

            <div className="bars">
              {sortedActivity.map((item) => {
                const dateObj = new Date(item.date);
                const dayLabel = isNaN(dateObj.getTime())
                  ? item.date
                  : weekdayFormatter.format(dateObj);
                const heightPercent = Math.max(4, (item.verifiedDepositCount / maxActivity) * 100);

                return (
                  <div key={item.date} className="bar-col">
                    <i
                      className="bar-fill"
                      style={{ height: `${heightPercent}%` }}
                      title={`${item.date}: ${item.verifiedDepositCount} verified deposits`}
                    />
                    <span className="bar-label">{dayLabel}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Material Mix Donut Chart */}
        <div className="panel">
          <div className="panel-head">
            <div>
              <h2>Material Mix</h2>
              <p>Collected recyclable distribution by weight</p>
            </div>
          </div>

          <div className="donut-wrap">
            <div
              className="donut"
              style={{ background: `conic-gradient(${gradientStops})` }}
            >
              <div className="donut-inner">
                <strong>{formatWeight(summary.totalWeightKg)}</strong>
                <small>Total Weight</small>
              </div>
            </div>

            <div className="legend">
              {summary.materialMix.map((mix) => {
                const percent =
                  summary.totalWeightKg > 0
                    ? ((mix.weightKg / summary.totalWeightKg) * 100).toFixed(0)
                    : "0";

                return (
                  <div key={mix.materialType} className="legend-item">
                    <span className={`legend-chip ${mix.materialType}`} />
                    <span>{mix.displayName}</span>
                    <strong>{percent}%</strong>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Attention Bins Section */}
      <div className="panel">
        <div className="panel-head">
          <div>
            <h2>Attention Bins</h2>
            <p>Smart bins approaching capacity thresholds or offline status</p>
          </div>
          <NavLink to="/bins">
            <Button variant="ghost">
              View All Bins
            </Button>
          </NavLink>
        </div>

        <DataTable<SmartBinRow, "id" | "locationName" | "capacityPercent">
          caption=""
          rows={summary.attentionBins}
          columns={attentionColumns}
          getRowId={(row) => row.bin.id}
          sort={{ key: "capacityPercent", direction: "desc" }}
          onSortChange={() => { }}
          loading={false}
          error={null}
          onRetry={() => { }}
          emptyTitle="No attention bins at this time — all bins operating normally"
        />
      </div>
    </div>
  );
}
