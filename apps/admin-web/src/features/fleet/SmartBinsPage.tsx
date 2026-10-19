// =============================================================================
// SmartBinsPage.tsx — Fleet management, live search/filtering & validated CRUD
// Phase 7 — SmartBinRow data table, server-driven sort, pagination & bin form modals
// =============================================================================

import * as React from "react";
import { useSearchParams } from "react-router-dom";
import { services, useObservableQuery, useMutation } from "../../app/services.ts";
import type {
  SmartBinRow,
  BinInput,
  BinSortKey,
  CapacityBand,
  CollectionStatus
} from "../../contracts/admin.ts";
import type { MaterialType, SmartBin } from "../../contracts/shared.ts";
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
import "./fleet.css";

// ---------------------------------------------------------------------------
// 1. Form Types & Constants
// ---------------------------------------------------------------------------

type BinFormErrors = Partial<
  Record<
    "id" | "locationName" | "locationDetail" | "capacityPercent" | "acceptedMaterials",
    string
  >
>;

interface BinFormState {
  id: string;
  locationName: string;
  locationDetail: string;
  capacityPercent: string;
  acceptedMaterials: MaterialType[];
  isOnline: boolean;
}

const INITIAL_FORM: BinFormState = {
  id: "",
  locationName: "",
  locationDetail: "",
  capacityPercent: "0",
  acceptedMaterials: [],
  isOnline: true
};

const AVAILABLE_MATERIALS: { type: MaterialType; label: string }[] = [
  { type: "plastic", label: "Plastic" },
  { type: "aluminium", label: "Aluminium" },
  { type: "paper", label: "Paper" },
  { type: "glass", label: "Glass" }
];

const COLLECTION_LABELS: Record<CollectionStatus, string> = {
  notScheduled: "Not Scheduled",
  pending: "Pending Collection",
  scheduled: "Collection Scheduled",
  collected: "Collected"
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
      capacityPercent: String(bin.capacityPercent),
      acceptedMaterials: [...bin.acceptedMaterials],
      isOnline: bin.isOnline
    });
    setFormErrors({});
    saveMutation.clearError();
    setModalOpen(true);
  };

  const handleMaterialToggle = (material: MaterialType) => {
    setFormState((prev) => {
      const exists = prev.acceptedMaterials.includes(material);
      const next = exists
        ? prev.acceptedMaterials.filter((m) => m !== material)
        : [...prev.acceptedMaterials, material];
      return { ...prev, acceptedMaterials: next };
    });
    if (formErrors.acceptedMaterials) {
      setFormErrors((prev) => ({ ...prev, acceptedMaterials: undefined }));
    }
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
    const cap = Number(formState.capacityPercent);
    if (isNaN(cap) || !Number.isInteger(cap) || cap < 0 || cap > 100) {
      errors.capacityPercent = "Capacity must be an integer between 0 and 100%.";
    }
    if (formState.acceptedMaterials.length === 0) {
      errors.acceptedMaterials = "Select at least one accepted material.";
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
      capacityPercent: Number(formState.capacityPercent),
      acceptedMaterials: formState.acceptedMaterials,
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
      header: "Collection Status",
      cell: (row) => (
        <span style={{ fontSize: "12px", color: "var(--muted)" }}>
          {COLLECTION_LABELS[row.operations.collectionStatus]}
        </span>
      )
    },
    {
      id: "actions",
      header: "Actions",
      cell: (row) => (
        <div style={{ display: "flex", gap: "6px" }}>
          <Button
            variant="secondary"
            onClick={() => handleOpenEditModal(row.bin)}
          >
            Edit
          </Button>
          <Button
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
        { value: "pending", label: "Pending" },
        { value: "scheduled", label: "Scheduled" },
        { value: "collected", label: "Collected" }
      ]
    },
    {
      id: "online",
      label: "Connectivity",
      value: query.online,
      options: [
        { value: "all", label: "All Connectivity" },
        { value: "online", label: "Online Only" },
        { value: "offline", label: "Offline Only" }
      ]
    }
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <AdminPageHeader
        eyebrow="FLEET OPERATIONS"
        title="Smart Bins Fleet"
        description="Monitor bin fill levels, manage registered bins, configure accepted recyclables, and schedule collections."
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
      <div style={{ background: "var(--surface)", borderRadius: "var(--radius)", border: "1px solid var(--line)" }}>
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

            <TextInput
              id="bin-form-capacity"
              label="Fill Capacity (%)"
              type="number"
              min={0}
              max={100}
              value={formState.capacityPercent}
              onChange={(val) => {
                setFormState((prev) => ({ ...prev, capacityPercent: val }));
                if (formErrors.capacityPercent) {
                  setFormErrors((prev) => ({ ...prev, capacityPercent: undefined }));
                }
              }}
              required
              disabled={saveMutation.pending}
              error={formErrors.capacityPercent}
            />
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

          {/* Accepted Materials Multi-Select */}
          <div className="material-checkboxes-field">
            <span className="material-checkboxes-label">Accepted Recyclable Materials *</span>
            <div className="material-checkboxes-grid">
              {AVAILABLE_MATERIALS.map((mat) => {
                const checked = formState.acceptedMaterials.includes(mat.type);
                return (
                  <label key={mat.type} className="material-checkbox-item">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleMaterialToggle(mat.type)}
                      disabled={saveMutation.pending}
                    />
                    <span>{mat.label}</span>
                  </label>
                );
              })}
            </div>
            {formErrors.acceptedMaterials && (
              <span className="form-error" role="alert">
                {formErrors.acceptedMaterials}
              </span>
            )}
          </div>

          <CheckboxInput
            id="bin-form-online"
            label="Receptacle online & transmitting telemetry"
            checked={formState.isOnline}
            onChange={(val) => setFormState((prev) => ({ ...prev, isOnline: val }))}
            disabled={saveMutation.pending}
          />
        </form>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(deleteCandidate)}
        onCancel={() => setDeleteCandidate(null)}
        title={`Delete Smart Bin: ${deleteCandidate?.id ?? ""}`}
        description={`Are you sure you want to delete ${deleteCandidate?.id ?? ""} (${deleteCandidate?.locationName ?? ""}) from the fleet? This operation cannot be undone.`}
        confirmLabel="Delete Bin"
        variant="danger"
        busy={deleteMutation.pending}
        error={deleteError}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
