// =============================================================================
// ListControls.tsx — Search, filtering and pagination components & URL query parsers
// Phase 5 — SearchFilterBar, Pagination & URLSearchParams parsing/patching
// =============================================================================

import * as React from "react";
import type {
  PageSize,
  SortDirection,
  BinSortKey,
  BinListQuery,
  CapacityBand,
  CollectionStatus,
  AlertSortKey,
  AlertListQuery,
  AlertStatus,
  VerificationSortKey,
  VerificationListQuery,
  VerificationStatus,
  RewardSortKey,
  RewardListQuery
} from "../contracts/admin.ts";
import { Icon, type SelectOption } from "./primitives.tsx";
import "./data-table.css";

// ---------------------------------------------------------------------------
// 1. Types & Interfaces
// ---------------------------------------------------------------------------

export type FilterId =
  | "capacityBand"
  | "collectionStatus"
  | "online"
  | "status"
  | "categoryId"
  | "publication";

export interface FilterField {
  id: FilterId;
  label: string;
  value: string;
  options: readonly SelectOption[];
}

export interface SearchFilterBarProps {
  search: string;
  searchLabel: string;
  onSearchChange: (value: string) => void;
  filters: readonly FilterField[];
  onFilterChange: (id: FilterId, value: string) => void;
  onReset: () => void;
}

export interface PaginationProps {
  page: number;
  pageSize: PageSize;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: PageSize) => void;
}

// ---------------------------------------------------------------------------
// 2. SearchFilterBar Component
// ---------------------------------------------------------------------------

export function SearchFilterBar(props: SearchFilterBarProps): React.ReactElement {
  const { search, searchLabel, onSearchChange, filters, onFilterChange, onReset } = props;

  return (
    <div className="toolbar" role="search" aria-label={searchLabel}>
      <div className="search">
        <Icon name="search" size={15} />
        <label htmlFor="search-filter-input" className="visually-hidden">
          {searchLabel}
        </label>
        <input
          id="search-filter-input"
          type="search"
          placeholder={searchLabel}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className="filter-row">
        {filters.map((filter) => (
          <div key={filter.id} className="filter-select-wrap">
            <label htmlFor={`filter-${filter.id}`} className="visually-hidden">
              {filter.label}
            </label>
            <select
              id={`filter-${filter.id}`}
              className="filter-select"
              value={filter.value}
              aria-label={filter.label}
              onChange={(e) => onFilterChange(filter.id, e.target.value)}
            >
              {filter.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        ))}

        <button
          type="button"
          className="btn ghost btn-sm filter-reset-btn"
          onClick={onReset}
        >
          Reset
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. Pagination Component
// ---------------------------------------------------------------------------

export function Pagination(props: PaginationProps): React.ReactElement {
  const { page, pageSize, total, onPageChange, onPageSizeChange } = props;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const isFirstPage = page <= 1;
  const isLastPage = page >= totalPages;

  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <nav className="pagination-bar" aria-label="Table pagination">
      <div className="pagination-info">
        {total === 0 ? (
          <span>0 items</span>
        ) : (
          <span>
            Showing <strong>{start}</strong>–<strong>{end}</strong> of <strong>{total}</strong>
          </span>
        )}
      </div>

      <div className="pagination-actions">
        <div className="page-size-wrap">
          <label htmlFor="page-size-select" className="page-size-label">
            Rows:
          </label>
          <select
            id="page-size-select"
            className="page-size-select"
            value={pageSize}
            aria-label="Rows per page"
            onChange={(e) => {
              const val = Number(e.target.value);
              if (val === 5 || val === 10 || val === 20) {
                onPageSizeChange(val as PageSize);
              }
            }}
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
          </select>
        </div>

        <div className="pagination-nav-btns">
          <button
            type="button"
            className="btn secondary btn-sm"
            disabled={isFirstPage}
            onClick={() => onPageChange(page - 1)}
            aria-label="Previous page"
          >
            Previous
          </button>

          <span className="page-current" aria-current="page">
            Page {page} of {totalPages}
          </span>

          <button
            type="button"
            className="btn secondary btn-sm"
            disabled={isLastPage}
            onClick={() => onPageChange(page + 1)}
            aria-label="Next page"
          >
            Next
          </button>
        </div>
      </div>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// 4. Query Parsing & Patching Utilities
// ---------------------------------------------------------------------------

function parseSearch(params: URLSearchParams): string {
  return params.get("search") ?? "";
}

function parsePage(params: URLSearchParams): number {
  const raw = params.get("page");
  if (!raw) return 1;
  const num = Number(raw);
  return Number.isInteger(num) && num >= 1 ? num : 1;
}

function parsePageSize(params: URLSearchParams): PageSize {
  const raw = params.get("pageSize");
  if (raw === "10") return 10;
  if (raw === "20") return 20;
  return 5;
}

function parseDirection(params: URLSearchParams, fallback: SortDirection): SortDirection {
  const raw = params.get("direction");
  if (raw === "asc" || raw === "desc") return raw;
  return fallback;
}

export function parseBinQuery(params: URLSearchParams): BinListQuery {
  const search = parseSearch(params);
  const page = parsePage(params);
  const pageSize = parsePageSize(params);

  const rawSort = params.get("sort");
  const sortKey: BinSortKey =
    rawSort === "locationName" ||
      rawSort === "capacityPercent" ||
      rawSort === "lastUpdatedAt"
      ? rawSort
      : "id";

  const direction = parseDirection(params, "asc");

  const rawBand = params.get("capacityBand");
  const capacityBand: CapacityBand | "all" =
    rawBand === "normal" || rawBand === "warning" || rawBand === "critical"
      ? rawBand
      : "all";

  const rawColl = params.get("collectionStatus");
  const collectionStatus: CollectionStatus | "all" =
    rawColl === "notScheduled" ||
      rawColl === "pending" ||
      rawColl === "scheduled" ||
      rawColl === "collected"
      ? rawColl
      : "all";

  const rawOnline = params.get("online");
  const online: "all" | "online" | "offline" =
    rawOnline === "online" || rawOnline === "offline" ? rawOnline : "all";

  return {
    search,
    page,
    pageSize,
    sort: { key: sortKey, direction },
    capacityBand,
    collectionStatus,
    online
  };
}

export function parseAlertQuery(params: URLSearchParams): AlertListQuery {
  const search = parseSearch(params);
  const page = parsePage(params);
  const pageSize = parsePageSize(params);

  const rawSort = params.get("sort");
  const sortKey: AlertSortKey = rawSort === "capacityPercent" ? rawSort : "triggeredAt";
  const direction = parseDirection(params, "desc");

  const rawStatus = params.get("status");
  const status: AlertStatus = rawStatus === "resolved" ? "resolved" : "active";

  return {
    search,
    page,
    pageSize,
    sort: { key: sortKey, direction },
    status
  };
}

export function parseVerificationQuery(params: URLSearchParams): VerificationListQuery {
  const search = parseSearch(params);
  const page = parsePage(params);
  const pageSize = parsePageSize(params);

  const rawSort = params.get("sort");
  const sortKey: VerificationSortKey =
    rawSort === "confidencePercent" ? rawSort : "occurredAt";
  const direction = parseDirection(params, "desc");

  const rawStatus = params.get("status");
  const status: VerificationStatus =
    rawStatus === "approved" || rawStatus === "rejected" ? rawStatus : "awaitingReview";

  return {
    search,
    page,
    pageSize,
    sort: { key: sortKey, direction },
    status
  };
}

export function parseRewardQuery(params: URLSearchParams): RewardListQuery {
  const search = parseSearch(params);
  const page = parsePage(params);
  const pageSize = parsePageSize(params);

  const rawSort = params.get("sort");
  const sortKey: RewardSortKey =
    rawSort === "pointsCost" || rawSort === "expiresAt" ? rawSort : "title";
  const direction = parseDirection(params, "asc");

  const rawPub = params.get("publication");
  const publication: "all" | "active" | "draft" =
    rawPub === "active" || rawPub === "draft" ? rawPub : "all";

  const rawCategory = params.get("categoryId");
  const categoryId =
    !rawCategory || rawCategory.trim() === "" || rawCategory === "null" || rawCategory === "all"
      ? null
      : rawCategory.trim();

  return {
    search,
    page,
    pageSize,
    sort: { key: sortKey, direction },
    categoryId,
    publication
  };
}

export function patchQuery(
  params: URLSearchParams,
  patch: Record<string, string | null>
): URLSearchParams {
  const next = new URLSearchParams(params.toString());
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === undefined) {
      next.delete(key);
    } else {
      next.set(key, value);
    }
  }
  return next;
}
