// =============================================================================
// main.tsx — EcoLoop Admin Web Portal Entry Point
// Phase 5 — Controlled DataTable, ListControls & Query Parsers Showcase
// =============================================================================

import * as React from "react";
import { createRoot } from "react-dom/client";
import "./theme.css";
import "./ui/data-table.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/inter/800.css";

import type { SortSpec, PageSize } from "./contracts/admin.ts";
import { AdminPageHeader, Button, Badge } from "./ui/primitives.tsx";
import { DataTable, type Column } from "./ui/DataTable.tsx";
import {
  SearchFilterBar,
  Pagination,
  parseBinQuery,
  parseAlertQuery,
  parseVerificationQuery,
  parseRewardQuery,
  patchQuery,
  type FilterField,
  type FilterId
} from "./ui/ListControls.tsx";

// ---------------------------------------------------------------------------
// Structural Preview Row Type (strictly non-business dummy type)
// ---------------------------------------------------------------------------
type PreviewSortKey = "id" | "label";
interface PreviewRow {
  id: string;
  label: string;
}

// ---------------------------------------------------------------------------
// Phase 5 Interactive Component Showcase
// ---------------------------------------------------------------------------
export function BootstrapPreview(): React.ReactElement {
  // Table state
  const [sort, setSort] = React.useState<SortSpec<PreviewSortKey>>({
    key: "id",
    direction: "asc"
  });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Search and filter state
  const [search, setSearch] = React.useState("");
  const [filterBand, setFilterBand] = React.useState("all");
  const [filterStatus, setFilterStatus] = React.useState("all");

  // Pagination state
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState<PageSize>(5);
  const [demoTotal, setDemoTotal] = React.useState(0);

  // URL Query inspection state (reads window.location.search)
  const [urlSearch, setUrlSearch] = React.useState(
    typeof window !== "undefined" ? window.location.search : ""
  );

  const parsedQueries = React.useMemo(() => {
    const params = new URLSearchParams(urlSearch);
    return {
      bin: parseBinQuery(params),
      alert: parseAlertQuery(params),
      verification: parseVerificationQuery(params),
      reward: parseRewardQuery(params)
    };
  }, [urlSearch]);

  const columns: readonly Column<PreviewRow, PreviewSortKey>[] = [
    {
      id: "id",
      header: "Identifier",
      sortKey: "id",
      cell: (row) => <code>{row.id}</code>
    },
    {
      id: "label",
      header: "Label",
      sortKey: "label",
      cell: (row) => <span>{row.label}</span>
    },
    {
      id: "status",
      header: "Status",
      cell: () => <Badge tone="green">Active</Badge>
    }
  ];

  const filterFields: readonly FilterField[] = [
    {
      id: "capacityBand",
      label: "Capacity Band",
      value: filterBand,
      options: [
        { value: "all", label: "All Bands" },
        { value: "normal", label: "Normal (<75%)" },
        { value: "warning", label: "Warning (75-84%)" },
        { value: "critical", label: "Critical (85%+)" }
      ]
    },
    {
      id: "status",
      label: "Status",
      value: filterStatus,
      options: [
        { value: "all", label: "All Statuses" },
        { value: "active", label: "Active" },
        { value: "resolved", label: "Resolved" }
      ]
    }
  ];

  const handleFilterChange = (id: FilterId, value: string) => {
    if (id === "capacityBand") setFilterBand(value);
    if (id === "status") setFilterStatus(value);
    setPage(1);
  };

  const handleResetFilters = () => {
    setSearch("");
    setFilterBand("all");
    setFilterStatus("all");
    setPage(1);
  };

  const handleApplyInvalidUrlTest = () => {
    const current = new URLSearchParams(window.location.search);
    const patched = patchQuery(current, {
      page: "-99",
      pageSize: "999",
      sort: "malicious_sql_inject",
      direction: "sideways",
      status: "unknown_enum",
      capacityBand: "ultra_high",
      online: "maybe"
    });
    window.history.replaceState(null, "", `?${patched.toString()}`);
    setUrlSearch(`?${patched.toString()}`);
  };

  const handleResetUrlParams = () => {
    window.history.replaceState(null, "", window.location.pathname);
    setUrlSearch("");
  };

  // Strictly empty rows per Phase 5 specification
  const rows: readonly PreviewRow[] = [];

  return (
    <main style={{ maxWidth: "1080px", margin: "0 auto", padding: "40px 24px" }}>
      <AdminPageHeader
        eyebrow="PHASE 5 COMPONENT SHOWCASE"
        title="Data Table, List Controls & Query Parsers"
        description="Controlled empty data table with server-driven sorting, accessible captions, filter toolbar, pagination, and URL query parsers."
        actions={
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <Button
              variant="secondary"
              onClick={() => {
                setLoading((prev) => !prev);
                setError(null);
              }}
            >
              Toggle Loading ({loading ? "ON" : "OFF"})
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setError((prev) => (prev ? null : "Simulated connection timeout to server"));
                setLoading(false);
              }}
            >
              Toggle Error ({error ? "ON" : "OFF"})
            </Button>
            <Button
              variant="secondary"
              onClick={() => setDemoTotal((prev) => (prev === 0 ? 24 : 0))}
            >
              Toggle Total Items ({demoTotal === 0 ? "0 (empty)" : "24 items"})
            </Button>
          </div>
        }
      />

      <section style={{ marginTop: "32px" }}>
        <h2 style={{ fontSize: "16px", marginBottom: "16px", color: "var(--muted)" }}>
          1. Generic List Toolbar (SearchFilterBar)
        </h2>
        <SearchFilterBar
          search={search}
          searchLabel="Search structural preview..."
          onSearchChange={(val) => {
            setSearch(val);
            setPage(1);
          }}
          filters={filterFields}
          onFilterChange={handleFilterChange}
          onReset={handleResetFilters}
        />

        <h2 style={{ fontSize: "16px", margin: "24px 0 16px", color: "var(--muted)" }}>
          2. Generic DataTable & Pagination Controls
        </h2>
        <div style={{ background: "white", borderRadius: "16px", border: "1px solid var(--line)" }}>
          <DataTable<PreviewRow, PreviewSortKey>
            caption="Controlled structural preview table"
            rows={rows}
            columns={columns}
            getRowId={(row) => row.id}
            sort={sort}
            onSortChange={(nextSort) => setSort(nextSort)}
            loading={loading}
            error={error}
            onRetry={() => {
              setError(null);
              setLoading(true);
              setTimeout(() => setLoading(false), 500);
            }}
            emptyTitle="No structural preview records found"
          />
          <Pagination
            page={page}
            pageSize={pageSize}
            total={demoTotal}
            onPageChange={(nextPage) => setPage(nextPage)}
            onPageSizeChange={(nextSize) => {
              setPageSize(nextSize);
              setPage(1);
            }}
          />
        </div>

        <div style={{ marginTop: "12px", fontSize: "12px", color: "var(--muted)" }}>
          Current table sort state: <code>{JSON.stringify(sort)}</code> | Search: &ldquo;{search}&rdquo; | Band: <code>{filterBand}</code> | Status: <code>{filterStatus}</code>
        </div>
      </section>

      <section style={{ marginTop: "40px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div>
            <h2 style={{ fontSize: "16px", margin: 0, color: "var(--muted)" }}>
              3. URLSearchParams Query Parser Verification
            </h2>
            <p style={{ fontSize: "12px", color: "var(--muted)", margin: "4px 0 0" }}>
              Active query string: <code>{urlSearch || "(empty query string)"}</code>
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <Button variant="secondary" onClick={handleApplyInvalidUrlTest}>
              Inject Invalid Query Values
            </Button>
            <Button variant="ghost" onClick={handleResetUrlParams}>
              Reset URL
            </Button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
          <div style={{ background: "white", padding: "16px", borderRadius: "12px", border: "1px solid var(--line)" }}>
            <h3 style={{ fontSize: "13px", margin: "0 0 8px", color: "var(--green)" }}>BinListQuery</h3>
            <pre style={{ margin: 0, fontSize: "11px", overflowX: "auto" }}>
              {JSON.stringify(parsedQueries.bin, null, 2)}
            </pre>
          </div>

          <div style={{ background: "white", padding: "16px", borderRadius: "12px", border: "1px solid var(--line)" }}>
            <h3 style={{ fontSize: "13px", margin: "0 0 8px", color: "var(--green)" }}>AlertListQuery</h3>
            <pre style={{ margin: 0, fontSize: "11px", overflowX: "auto" }}>
              {JSON.stringify(parsedQueries.alert, null, 2)}
            </pre>
          </div>

          <div style={{ background: "white", padding: "16px", borderRadius: "12px", border: "1px solid var(--line)" }}>
            <h3 style={{ fontSize: "13px", margin: "0 0 8px", color: "var(--green)" }}>VerificationListQuery</h3>
            <pre style={{ margin: 0, fontSize: "11px", overflowX: "auto" }}>
              {JSON.stringify(parsedQueries.verification, null, 2)}
            </pre>
          </div>

          <div style={{ background: "white", padding: "16px", borderRadius: "12px", border: "1px solid var(--line)" }}>
            <h3 style={{ fontSize: "13px", margin: "0 0 8px", color: "var(--green)" }}>RewardListQuery</h3>
            <pre style={{ margin: 0, fontSize: "11px", overflowX: "auto" }}>
              {JSON.stringify(parsedQueries.reward, null, 2)}
            </pre>
          </div>
        </div>
      </section>
    </main>
  );
}

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <BootstrapPreview />
    </React.StrictMode>
  );
}
