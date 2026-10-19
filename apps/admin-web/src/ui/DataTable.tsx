// =============================================================================
// DataTable.tsx — Generic, accessible data table component
// Phase 5 — Server-driven sorting, accessible captions & ARIA sort states
// =============================================================================

import * as React from "react";
import type { SortSpec } from "../contracts/admin.ts";
import { AsyncState } from "./primitives.tsx";

export interface Column<T, K extends string> {
  id: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  sortKey?: K;
}

export interface DataTableProps<T, K extends string> {
  caption: string;
  rows: readonly T[];
  columns: readonly Column<T, K>[];
  getRowId: (row: T) => string;
  sort: SortSpec<K>;
  onSortChange: (sort: SortSpec<K>) => void;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  emptyTitle: string;
}

export function DataTable<T, K extends string>(props: DataTableProps<T, K>): React.ReactElement {
  const {
    caption,
    rows,
    columns,
    getRowId,
    sort,
    onSortChange,
    loading,
    error,
    onRetry,
    emptyTitle
  } = props;

  const handleHeaderClick = (sortKey?: K) => {
    if (!sortKey) return;
    if (sort && sort.key === sortKey) {
      onSortChange({
        key: sortKey,
        direction: sort.direction === "asc" ? "desc" : "asc"
      });
    } else {
      onSortChange({
        key: sortKey,
        direction: "asc"
      });
    }
  };

  const colSpanCount = Math.max(1, columns.length);

  return (
    <div className="table-wrap">
      <table className="data-table">
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            {columns.map((col) => {
              const isSorted = Boolean(col.sortKey && sort && sort.key === col.sortKey);
              const ariaSort = !col.sortKey
                ? undefined
                : isSorted
                ? sort.direction === "asc"
                  ? "ascending"
                  : "descending"
                : "none";

              return (
                <th
                  key={col.id}
                  scope="col"
                  aria-sort={ariaSort}
                  className={col.sortKey ? "sortable-th" : undefined}
                >
                  {col.sortKey ? (
                    <button
                      type="button"
                      className="table-sort-btn"
                      onClick={() => handleHeaderClick(col.sortKey)}
                    >
                      <span>{col.header}</span>
                      <span className="sort-icon-wrap" aria-hidden="true">
                        {isSorted ? (
                          <span className={`sort-caret ${sort.direction}`}>
                            {sort.direction === "asc" ? "▲" : "▼"}
                          </span>
                        ) : (
                          <span className="sort-caret inactive">↕</span>
                        )}
                      </span>
                    </button>
                  ) : (
                    <span>{col.header}</span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={colSpanCount} className="table-state-cell">
                <AsyncState kind="loading" title="Loading data..." />
              </td>
            </tr>
          )}

          {!loading && error && (
            <tr>
              <td colSpan={colSpanCount} className="table-state-cell">
                <AsyncState kind="error" title="Unable to load data" description={error} onRetry={onRetry} />
              </td>
            </tr>
          )}

          {!loading && !error && rows.length === 0 && (
            <tr>
              <td colSpan={colSpanCount} className="table-state-cell">
                <AsyncState kind="empty" title={emptyTitle} />
              </td>
            </tr>
          )}

          {!loading &&
            !error &&
            rows.map((row) => (
              <tr key={getRowId(row)}>
                {columns.map((col) => (
                  <td key={col.id}>{col.cell(row)}</td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
