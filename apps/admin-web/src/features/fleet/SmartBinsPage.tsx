// =============================================================================
// SmartBinsPage.tsx — Fleet management, live search/filtering & validated CRUD
// Phase AB-04 — Registered QR codes, positive integer capacity, and shared policies
// =============================================================================

import * as React from "react";
import { useSearchParams } from "react-router-dom";
import { services, useObservableQuery, useMutation } from "../../app/services.ts";
import type {
  SmartBinRow,
  BinInput,
  BinSortKey,
  CapacityBand
} from "../../contracts/admin.ts";
import type { SmartBin } from "../../contracts/shared.ts";
import type { BinQrCode } from "../../data/repositories.ts";
import {
  AdminPageHeader,
  Button,
  Badge,
  TextInput,
  CheckboxInput,
  Feedback,
  Icon
} from "../../ui/primitives.tsx";
import { DataTable, type Column } from "../../ui/DataTable.tsx";
import {
  SearchFilterBar,
  Pagination,
  parseBinQuery,
  patchQuery,
  type FilterField,
  type FilterId
} from "../../ui/ListControls.tsx";
import { Modal, ConfirmDialog } from "../../ui/Modal.tsx";
import "../../ui/primitives.css";
import "../../ui/data-table.css";
import "./fleet.css";

// ---------------------------------------------------------------------------
// 1. Form Types & Constants
// ---------------------------------------------------------------------------

type BinFormErrors = Partial<
  Record<
    "id" | "locationName" | "locationDetail" | "capacitySpc",
    string
  >
>;

interface BinFormState {
  id: string;
  locationName: string;
  locationDetail: string;
  capacitySpc: string;
  isOnline: boolean;
}

const INITIAL_FORM: BinFormState = {
  id: "",
  locationName: "",
  locationDetail: "",
  capacitySpc: "1000",
  isOnline: true
};


function capacityBand(value: number): CapacityBand {
  if (value >= 85) return "critical";
  if (value >= 75) return "warning";
  return "normal";
}

// ---------------------------------------------------------------------------
// 2. SmartBinsPage Component
// ---------------------------------------------------------------------------

export function SmartBinsPage(): React.ReactElement {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = parseBinQuery(searchParams);

  // Observable fleet list query
  const listKey = `bins:${searchParams.toString()}`;
  const listQuery = useObservableQuery(listKey, () =>
    services.repositories.bins.watchList(query)
  );

  // Mutation handlers
  const saveMutation = useMutation();
  const deleteMutation = useMutation();

  // Top-level feedback message
  const [globalFeedback, setGlobalFeedback] = React.useState<string | null>(null);

  // Form modal state
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editingBin, setEditingBin] = React.useState<SmartBin | null>(null);
  const [formState, setFormState] = React.useState<BinFormState>(INITIAL_FORM);
  const [formErrors, setFormErrors] = React.useState<BinFormErrors>({});

  // Delete dialog state
  const [deleteCandidate, setDeleteCandidate] = React.useState<SmartBin | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  // QR modal state
  const [qrModalBin, setQrModalBin] = React.useState<SmartBin | null>(null);
  const [qrCodeData, setQrCodeData] = React.useState<BinQrCode | null>(null);
  const [qrLoading, setQrLoading] = React.useState<boolean>(false);
  const [qrError, setQrError] = React.useState<string | null>(null);

  const pageData = listQuery.data;

  // -------------------------------------------------------------------------
  // URL Update Handlers
  // -------------------------------------------------------------------------
  const updateQuery = (patch: Record<string, string | null>) => {
    const next = patchQuery(searchParams, patch);
    setSearchParams(next, { replace: true });
  };

  const handleSearchChange = (val: string) => {
    updateQuery({ search: val, page: "1" });
  };

  const handleFilterChange = (id: FilterId, val: string) => {
    updateQuery({ [id]: val, page: "1" });
  };

  const handleResetFilters = () => {
    updateQuery({
      search: "",
      capacityBand: "all",
      collectionStatus: "all",
      online: "all",
      page: "1"
    });
  };

  // -------------------------------------------------------------------------
  // CRUD Handlers
  // -------------------------------------------------------------------------
  const handleOpenCreateModal = () => {
    setEditingBin(null);
    setFormState(INITIAL_FORM);
    setFormErrors({});
    saveMutation.clearError();
    setModalOpen(true);
  };

  const handleOpenEditModal = (bin: SmartBin) => {
    setEditingBin(bin);
    setFormState({
      id: bin.id,
      locationName: bin.locationName,
      locationDetail: bin.locationDetail,
      capacitySpc: "1000",
      isOnline: bin.isOnline
    });
    setFormErrors({});
    saveMutation.clearError();
    setModalOpen(true);
  };

  const handleOpenQrModal = async (bin: SmartBin) => {
    setQrModalBin(bin);
    setQrCodeData(null);
    setQrError(null);
    setQrLoading(true);
    try {
      const data = await services.repositories.bins.getQrCode(bin.id);
      setQrCodeData(data);
    } catch (err) {
      setQrError(err instanceof Error ? err.message : String(err));
    } finally {
      setQrLoading(false);
    }
  };

  const handleDownloadPng = () => {
    if (!qrCodeData || !qrModalBin) return;
    const link = document.createElement("a");
    link.href = qrCodeData.dataUrl;
    link.download = `${qrModalBin.id}-qr.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadSvg = () => {
    if (!qrCodeData || !qrModalBin) return;
    const blob = new Blob([qrCodeData.svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${qrModalBin.id}-qr.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const validateForm = (): boolean => {
    const errors: BinFormErrors = {};
    if (!editingBin && !formState.id.trim()) {
      errors.id = "Bin ID is required (e.g. BIN-020).";
    }
    if (!formState.locationName.trim()) {
      errors.locationName = "Location name is required.";
    }
    if (!formState.locationDetail.trim()) {
      errors.locationDetail = "Location detail is required.";
    }
    if (!editingBin) {
      const cap = Number(formState.capacitySpc);
      if (isNaN(cap) || !Number.isInteger(cap) || cap < 50 || cap > 5000) {
        errors.capacitySpc = "Capacity must be an integer between 50 and 5000 spc.";
      }
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveBin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!validateForm()) return;

    saveMutation.clearError();
    const input: BinInput = {
      locationName: formState.locationName.trim(),
      locationDetail: formState.locationDetail.trim(),
      capacityPercent: editingBin ? editingBin.capacityPercent : 0,
      capacitySpc: Number(formState.capacitySpc),
      acceptedMaterials: ["plastic", "aluminium", "glass", "paper"],
      isOnline: formState.isOnline
    };

    let result: SmartBinRow | null = null;
    if (editingBin) {
      result = await saveMutation.run(() =>
        services.repositories.bins.update(editingBin.id, input)
      );
    } else {
      result = await saveMutation.run(() =>
        services.repositories.bins.create(formState.id.trim(), input)
      );
    }

    if (result) {
      setModalOpen(false);
      setGlobalFeedback(
        editingBin
          ? `Bin ${result.bin.id} updated successfully.`
          : `Bin ${result.bin.id} registered successfully.`
      );
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteCandidate) return;
    setDeleteError(null);
    deleteMutation.clearError();

    const success = await deleteMutation.run(async () => {
      await services.repositories.bins.delete(deleteCandidate.id);
      return true;
    });

    if (success) {
      const deletedId = deleteCandidate.id;
      setDeleteCandidate(null);
      setGlobalFeedback(`Bin ${deletedId} deleted successfully.`);
    } else if (deleteMutation.error) {
      setDeleteError(deleteMutation.error);
    }
  };

  // -------------------------------------------------------------------------
  // Table Columns Definition
  // -------------------------------------------------------------------------
  const columns: Column<SmartBinRow, BinSortKey>[] = [
    {
      id: "id",
      header: "Bin ID",
      sortKey: "id",
      cell: (row) => <strong>{row.bin.id}</strong>
    },
    {
      id: "location",
      header: "Location",
      sortKey: "locationName",
      cell: (row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.bin.locationName}</div>
          <small style={{ color: "var(--muted)", fontSize: "11px" }}>{row.bin.locationDetail}</small>
        </div>
      )
    },
    {
      id: "capacity",
      header: "Capacity",
      sortKey: "capacityPercent",
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
              <Badge tone="green">ENABLED</Badge>
            ) : (
              <Badge tone="gray">DISABLED</Badge>
            )}
          </div>
        );
      }
    },
    {
      id: "collection",
      header: "Collection Status",
      cell: (row) => {
        const cs = row.operations.collectionStatus;
        if (cs === "collected") {
          return <Badge tone="green">Collected</Badge>;
        }
        if (cs === "pending" || cs === "scheduled") {
          return <Badge tone="amber">Pending Collection</Badge>;
        }
        return <Badge tone="gray">Not Scheduled</Badge>;
      }
    },
    {
      id: "actions",
      header: "Actions",
      cell: (row) => (
        <div style={{ display: "flex", gap: "6px" }}>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void handleOpenQrModal(row.bin)}
          >
            QR
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => handleOpenEditModal(row.bin)}
          >
            Edit
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => {
              setDeleteCandidate(row.bin);
              setDeleteError(null);
            }}
          >
            Delete
          </Button>
        </div>
      )
    }
  ];

  // Filter toolbar configuration
  const filterFields: FilterField[] = [
    {
      id: "capacityBand",
      label: "Capacity",
      value: query.capacityBand,
      options: [
        { value: "all", label: "All Capacities" },
        { value: "normal", label: "Normal (<75%)" },
        { value: "warning", label: "Warning (75–84%)" },
        { value: "critical", label: "Critical (85%+)" }
      ]
    },
    {
      id: "collectionStatus",
      label: "Collection",
      value: query.collectionStatus,
      options: [
        { value: "all", label: "All Collections" },
        { value: "notScheduled", label: "Not Scheduled" },
        { value: "pending", label: "Pending Collection" },
        { value: "collected", label: "Collected" }
      ]
    },
    {
      id: "online",
      label: "State",
      value: query.online,
      options: [
        { value: "all", label: "All States" },
        { value: "online", label: "Enabled Only" },
        { value: "offline", label: "Disabled Only" }
      ]
    }
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <AdminPageHeader
        eyebrow="FLEET OPERATIONS"
        title="Smart Bins"
        description="Monitor bin fill levels, manage registered receptacles, and export registered QR codes."
        actions={
          <Button variant="primary" onClick={handleOpenCreateModal}>
            <Icon name="plus" size={16} />
            <span>Add Smart Bin</span>
          </Button>
        }
      />

      {globalFeedback && (
        <Feedback kind="success" onDismiss={() => setGlobalFeedback(null)}>
          {globalFeedback}
        </Feedback>
      )}

      {deleteError && (
        <Feedback kind="error" onDismiss={() => setDeleteError(null)}>
          {deleteError}
        </Feedback>
      )}

      {/* Search and Filters Toolbar */}
      <SearchFilterBar
        search={query.search}
        searchLabel="Search bins by location or ID..."
        onSearchChange={handleSearchChange}
        filters={filterFields}
        onFilterChange={handleFilterChange}
        onReset={handleResetFilters}
      />

      {/* Main Bins Data Table */}
      <div className="table-card">
        <DataTable<SmartBinRow, BinSortKey>
          caption="Smart Bins Fleet List"
          rows={pageData?.items ?? []}
          columns={columns}
          getRowId={(row) => row.bin.id}
          sort={query.sort}
          onSortChange={(nextSort) =>
            updateQuery({ sort: nextSort.key, direction: nextSort.direction, page: "1" })
          }
          loading={listQuery.loading && !pageData}
          error={listQuery.error}
          onRetry={listQuery.reload}
          emptyTitle="No smart bins match your filter criteria"
        />

        <Pagination
          page={pageData?.page ?? 1}
          pageSize={pageData?.pageSize ?? 5}
          total={pageData?.total ?? 0}
          onPageChange={(nextPage) => updateQuery({ page: String(nextPage) })}
          onPageSizeChange={(nextSize) => updateQuery({ pageSize: String(nextSize), page: "1" })}
        />
      </div>

      {/* Create / Edit Smart Bin Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingBin ? `Edit Smart Bin: ${editingBin.id}` : "Register New Smart Bin"}
        footer={
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", width: "100%" }}>
            <Button
              type="button"
              variant="secondary"
              disabled={saveMutation.pending}
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              busy={saveMutation.pending}
              onClick={() => {
                void handleSaveBin();
              }}
            >
              {editingBin ? "Save Changes" : "Register Bin"}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSaveBin} className="bin-form">
          {saveMutation.error && (
            <Feedback kind="error" onDismiss={() => saveMutation.clearError()}>
              {saveMutation.error}
            </Feedback>
          )}

          <div className="bin-form-grid">
            <TextInput
              id="bin-form-id"
              label="Bin Identifier"
              value={formState.id}
              onChange={(val) => {
                setFormState((prev) => ({ ...prev, id: val }));
                if (formErrors.id) setFormErrors((prev) => ({ ...prev, id: undefined }));
              }}
              placeholder="e.g. BIN-020"
              required
              disabled={Boolean(editingBin) || saveMutation.pending}
              error={formErrors.id}
              hint={editingBin ? "Identifier cannot be changed after registration." : undefined}
            />

            {editingBin ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--text)" }}>
                  Current Fill & Physical Capacity
                </label>
                <div style={{ padding: "8px 12px", background: "var(--surface-muted, #f3f5f3)", borderRadius: "var(--radius-control)", border: "1px solid var(--line)", fontSize: "13px" }}>
                  <strong>{editingBin.capacityPercent}%</strong> fill level
                </div>
                <small style={{ color: "var(--muted)", fontSize: "11px" }}>
                  Capacity is immutable post-registration. Fill percentage is derived from physical occupancy and resets automatically via collections.
                </small>
              </div>
            ) : (
              <TextInput
                id="bin-form-capacity"
                label="Physical Capacity (spc)"
                type="number"
                min={50}
                max={5000}
                value={formState.capacitySpc}
                onChange={(val) => {
                  setFormState((prev) => ({ ...prev, capacitySpc: val }));
                  if (formErrors.capacitySpc) {
                    setFormErrors((prev) => ({ ...prev, capacitySpc: undefined }));
                  }
                }}
                required
                disabled={saveMutation.pending}
                error={formErrors.capacitySpc}
                hint="Total physical space in spc (50–5000). Immutable once registered."
              />
            )}
          </div>

          <TextInput
            id="bin-form-location-name"
            label="Location Name"
            value={formState.locationName}
            onChange={(val) => {
              setFormState((prev) => ({ ...prev, locationName: val }));
              if (formErrors.locationName) {
                setFormErrors((prev) => ({ ...prev, locationName: undefined }));
              }
            }}
            placeholder="e.g. Cedar Residence, Maple Lobby"
            required
            disabled={saveMutation.pending}
            error={formErrors.locationName}
          />

          <TextInput
            id="bin-form-location-detail"
            label="Location Detail"
            value={formState.locationDetail}
            onChange={(val) => {
              setFormState((prev) => ({ ...prev, locationDetail: val }));
              if (formErrors.locationDetail) {
                setFormErrors((prev) => ({ ...prev, locationDetail: undefined }));
              }
            }}
            placeholder="e.g. Ground Floor, Recycling Corner"
            required
            disabled={saveMutation.pending}
            error={formErrors.locationDetail}
          />

          {/* Accepted Classes Informational Badges */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--text)" }}>
              Accepted Recyclable Classes (Shared Program Policy)
            </span>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              <Badge tone="green">Plastic Bottles</Badge>
              <Badge tone="amber">Aluminium Cans</Badge>
              <Badge tone="green">Glass Bottles</Badge>
              <Badge tone="gray">Paper Items</Badge>
              <Badge tone="gray">Paper Bags</Badge>
            </div>
            <small style={{ color: "var(--muted)", fontSize: "11px" }}>
              Accepted classes are governed globally by program settings and apply across all active fleet receptacles.
            </small>
          </div>

          <CheckboxInput
            id="bin-form-online"
            label="Receptacle enabled & accepting resident deposits"
            checked={formState.isOnline}
            onChange={(val) => setFormState((prev) => ({ ...prev, isOnline: val }))}
            disabled={saveMutation.pending}
          />
        </form>
      </Modal>

      {/* QR Code Preview & Download Modal */}
      <Modal
        open={Boolean(qrModalBin)}
        onClose={() => {
          setQrModalBin(null);
          setQrCodeData(null);
          setQrError(null);
        }}
        title={`Registered QR Code: ${qrModalBin?.id ?? ""}`}
        footer={
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
            <div style={{ display: "flex", gap: "8px" }}>
              <Button
                type="button"
                variant="secondary"
                disabled={!qrCodeData || qrLoading}
                onClick={handleDownloadPng}
              >
                Download PNG
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={!qrCodeData || qrLoading}
                onClick={handleDownloadSvg}
              >
                Download SVG
              </Button>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setQrModalBin(null);
                setQrCodeData(null);
                setQrError(null);
              }}
            >
              Close
            </Button>
          </div>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", alignItems: "center", textAlign: "center", padding: "12px 0" }}>
          {qrError && (
            <Feedback kind="error" onDismiss={() => setQrError(null)}>
              {qrError}
            </Feedback>
          )}

          {qrLoading && (
            <div style={{ padding: "40px", color: "var(--muted)" }}>
              <span>Generating registered QR code...</span>
            </div>
          )}

          {qrCodeData && (
            <>
              <div style={{ background: "white", padding: "16px", borderRadius: "12px", border: "1px solid var(--line)", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                <img
                  src={qrCodeData.dataUrl}
                  alt={`QR code for ${qrModalBin?.id}`}
                  style={{ width: "220px", height: "220px", display: "block" }}
                />
              </div>

              <div style={{ maxWidth: "100%", width: "100%" }}>
                <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>
                  Registered Hardware Payload
                </div>
                <code
                  style={{
                    display: "block",
                    padding: "8px 12px",
                    background: "var(--surface-muted, #f3f5f3)",
                    border: "1px solid var(--line)",
                    borderRadius: "6px",
                    fontSize: "12px",
                    wordBreak: "break-all",
                    fontFamily: "monospace"
                  }}
                >
                  {qrCodeData.qrPayload}
                </code>
              </div>

              <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)" }}>
                {qrModalBin?.locationName} — {qrModalBin?.locationDetail}
              </p>
            </>
          )}
        </div>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(deleteCandidate)}
        onCancel={() => setDeleteCandidate(null)}
        title={`Delete Smart Bin: ${deleteCandidate?.id ?? ""}`}
        description={`Are you sure you want to delete ${deleteCandidate?.id ?? ""} (${deleteCandidate?.locationName ?? ""}) from the fleet? This operation cannot be undone and is only allowed for never-used bins.`}
        confirmLabel="Delete Bin"
        variant="danger"
        busy={deleteMutation.pending}
        error={deleteError}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
