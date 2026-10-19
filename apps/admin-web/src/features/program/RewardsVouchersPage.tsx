// =============================================================================
// RewardsVouchersPage.tsx — Rewards catalog & voucher program management
// Phase 9 — RewardDocument CRUD, publication toggles, category filtering & modals
// =============================================================================

import * as React from "react";
import { useSearchParams } from "react-router-dom";
import { services, useObservableQuery, useMutation } from "../../app/services.ts";
import type { Reward } from "../../contracts/shared.ts";
import type {
  RewardInput,
  RewardSortKey,
  RewardListQuery
} from "../../contracts/admin.ts";
import {
  AdminPageHeader,
  Button,
  Badge,
  TextInput,
  SelectInput,
  CheckboxInput,
  Feedback,
  Icon
} from "../../ui/primitives.tsx";
import { DataTable, type Column } from "../../ui/DataTable.tsx";
import {
  SearchFilterBar,
  Pagination,
  parseRewardQuery,
  patchQuery,
  type FilterField,
  type FilterId
} from "../../ui/ListControls.tsx";
import { Modal, ConfirmDialog } from "../../ui/Modal.tsx";
import "./program.css";

// ---------------------------------------------------------------------------
// 1. Local Types & Form Contracts
// ---------------------------------------------------------------------------

interface RewardFormState {
  title: string;
  description: string;
  merchantName: string;
  categoryId: string;
  tag: string;
  imageUrl: string;
  pointsCost: string;
  expiresOn: string;
  isActive: boolean;
  maxRedemptionsPerResident: string;
  artKey: string;
  sortOrder: string;
}

type RewardFormField = keyof RewardFormState;
type RewardFormErrors = Partial<Record<RewardFormField, string>>;

const INITIAL_FORM: RewardFormState = {
  title: "",
  description: "",
  merchantName: "",
  categoryId: "food",
  tag: "",
  imageUrl: "",
  pointsCost: "",
  expiresOn: "",
  isActive: false,
  maxRedemptionsPerResident: "1",
  artKey: "art0",
  sortOrder: "0"
};

const ART_KEY_OPTIONS = [
  { value: "art0", label: "Green Theme (art0)" },
  { value: "art1", label: "Amber / Gold Theme (art1)" },
  { value: "art2", label: "Neutral Warm Theme (art2)" },
  { value: "art3", label: "Blue / Slate Theme (art3)" }
];

const dateFormatter = new Intl.DateTimeFormat("en-MY", {
  timeZone: "Asia/Kuala_Lumpur",
  year: "numeric",
  month: "short",
  day: "numeric"
});

function formatDate(iso: string): string {
  try {
    return dateFormatter.format(new Date(iso));
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// 2. RewardsVouchersPage Component
// ---------------------------------------------------------------------------

export function RewardsVouchersPage(): React.ReactElement {
  const [searchParams, setSearchParams] = useSearchParams();
  const query: RewardListQuery = parseRewardQuery(searchParams);

  // Observable list query
  const listKey = `rewards:${searchParams.toString()}`;
  const listQuery = useObservableQuery(listKey, () =>
    services.repositories.rewards.watchList(query)
  );

  // Observable categories
  const categoriesQuery = useObservableQuery("rewards.categories", () =>
    services.repositories.rewards.watchCategories()
  );
  const categories = categoriesQuery.data ?? [];

  // Mutations
  const formMutation = useMutation();
  const toggleMutation = useMutation();
  const deleteMutation = useMutation();

  // Dialog & Form State
  const [isModalOpen, setIsModalOpen] = React.useState<boolean>(false);
  const [modalMode, setModalMode] = React.useState<"create" | "edit">("create");
  const [editingRewardId, setEditingRewardId] = React.useState<string | null>(null);
  const [formState, setFormState] = React.useState<RewardFormState>(INITIAL_FORM);
  const [formErrors, setFormErrors] = React.useState<RewardFormErrors>({});

  // Delete Confirm State
  const [deletingReward, setDeletingReward] = React.useState<Reward | null>(null);
  const [pageFeedback, setPageFeedback] = React.useState<string | null>(null);

  // Handlers for Filters & Pagination
  const handleSearchChange = (search: string) => {
    setSearchParams(patchQuery(searchParams, { search: search || null, page: "1" }));
  };

  const handleFilterChange = (id: FilterId, value: string) => {
    if (id === "categoryId") {
      setSearchParams(
        patchQuery(searchParams, {
          categoryId: value === "all" ? null : value,
          page: "1"
        })
      );
    } else if (id === "publication") {
      setSearchParams(
        patchQuery(searchParams, {
          publication: value === "all" ? null : value,
          page: "1"
        })
      );
    }
  };

  const handleResetFilters = () => {
    setSearchParams(
      patchQuery(searchParams, {
        search: null,
        categoryId: null,
        publication: null,
        page: "1"
      })
    );
  };

  const handleSortChange = (sort: { key: RewardSortKey; direction: "asc" | "desc" }) => {
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

  // Open Create Modal
  const handleOpenCreate = () => {
    formMutation.clearError();
    setModalMode("create");
    setEditingRewardId(null);
    setFormState({
      ...INITIAL_FORM,
      categoryId: categories[0]?.id ?? "food"
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  // Open Edit Modal (Promise read preloads record)
  const handleOpenEdit = async (id: string) => {
    formMutation.clearError();
    setModalMode("edit");
    setEditingRewardId(id);
    setFormErrors({});

    try {
      const record = await services.repositories.rewards.get(id);
      setFormState({
        title: record.title,
        description: record.description,
        merchantName: record.merchantName,
        categoryId: record.categoryId,
        tag: record.tag ?? "",
        imageUrl: record.imageUrl ?? "",
        pointsCost: String(record.pointsCost),
        expiresOn: record.expiresAt.slice(0, 10),
        isActive: record.isActive,
        maxRedemptionsPerResident: String(record.maxRedemptionsPerResident),
        artKey: record.artKey,
        sortOrder: String(record.sortOrder)
      });
      setIsModalOpen(true);
    } catch (err) {
      setPageFeedback(
        `Unable to load reward: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  };

  // Toggle Active/Draft (Full input reconstructed)
  const handleToggleActive = async (reward: Reward) => {
    setPageFeedback(null);
    toggleMutation.clearError();

    const input: RewardInput = {
      title: reward.title,
      description: reward.description,
      merchantName: reward.merchantName,
      categoryId: reward.categoryId,
      tag: reward.tag,
      imageUrl: reward.imageUrl,
      pointsCost: reward.pointsCost,
      expiresAt: reward.expiresAt,
      isActive: !reward.isActive,
      maxRedemptionsPerResident: reward.maxRedemptionsPerResident,
      artKey: reward.artKey,
      sortOrder: reward.sortOrder
    };

    const result = await toggleMutation.run(() =>
      services.repositories.rewards.update(reward.id, input)
    );
    if (result) {
      setPageFeedback(
        `Reward "${reward.title}" set to ${result.isActive ? "Active" : "Draft"}.`
      );
    }
  };

  // Delete Handlers
  const handleOpenDelete = (reward: Reward) => {
    deleteMutation.clearError();
    setDeletingReward(reward);
  };

  const handleConfirmDelete = async () => {
    if (!deletingReward) return;
    const result = await deleteMutation.run(() =>
      services.repositories.rewards.delete(deletingReward.id)
    );
    if (result !== null) {
      setPageFeedback(`Reward "${deletingReward.title}" removed successfully.`);
      setDeletingReward(null);
    }
  };

  // Form Field Validation
  const validateForm = (): boolean => {
    const errors: RewardFormErrors = {};

    if (!formState.title.trim()) {
      errors.title = "Title is required";
    }
    if (!formState.merchantName.trim()) {
      errors.merchantName = "Merchant name is required";
    }
    if (!formState.description.trim()) {
      errors.description = "Description is required";
    }
    if (!formState.categoryId) {
      errors.categoryId = "Category is required";
    }

    const points = Number(formState.pointsCost);
    if (!formState.pointsCost || !Number.isInteger(points) || points <= 0) {
      errors.pointsCost = "Points cost must be a positive integer";
    }

    if (!formState.expiresOn || !/^\d{4}-\d{2}-\d{2}$/.test(formState.expiresOn)) {
      errors.expiresOn = "Expiry date is required (YYYY-MM-DD)";
    } else {
      const iso = `${formState.expiresOn}T23:59:59+08:00`;
      if (new Date(iso).getTime() <= Date.now()) {
        errors.expiresOn = "Expiry date must be in the future";
      }
    }

    const maxRedemptions = Number(formState.maxRedemptionsPerResident);
    if (
      !formState.maxRedemptionsPerResident ||
      !Number.isInteger(maxRedemptions) ||
      maxRedemptions < 1
    ) {
      errors.maxRedemptionsPerResident = "Must be an integer >= 1";
    }

    const sort = Number(formState.sortOrder);
    if (!formState.sortOrder || !Number.isInteger(sort) || sort < 0) {
      errors.sortOrder = "Sort order must be an integer >= 0";
    }

    if (
      formState.imageUrl.trim() &&
      !formState.imageUrl.trim().startsWith("https://")
    ) {
      errors.imageUrl = "Image URL must be HTTPS";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Form Submission
  const handleSubmitForm = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!validateForm()) return;

    const input: RewardInput = {
      title: formState.title.trim(),
      description: formState.description.trim(),
      merchantName: formState.merchantName.trim(),
      categoryId: formState.categoryId,
      tag: formState.tag.trim() ? formState.tag.trim() : null,
      imageUrl: formState.imageUrl.trim() ? formState.imageUrl.trim() : null,
      pointsCost: Number(formState.pointsCost),
      expiresAt: `${formState.expiresOn}T23:59:59+08:00`,
      isActive: formState.isActive,
      maxRedemptionsPerResident: Number(formState.maxRedemptionsPerResident),
      artKey: formState.artKey || "art0",
      sortOrder: Number(formState.sortOrder) || 0
    };

    if (modalMode === "create") {
      const result = await formMutation.run(() =>
        services.repositories.rewards.create(input)
      );
      if (result) {
        setIsModalOpen(false);
        setPageFeedback(`Reward "${result.title}" created successfully.`);
      }
    } else if (modalMode === "edit" && editingRewardId) {
      const result = await formMutation.run(() =>
        services.repositories.rewards.update(editingRewardId, input)
      );
      if (result) {
        setIsModalOpen(false);
        setPageFeedback(`Reward "${result.title}" updated successfully.`);
      }
    }
  };

  // Filter Bar Config
  const categoryOptions = [
    { value: "all", label: "All Categories" },
    ...categories.map((c) => ({ value: c.id, label: c.label }))
  ];

  const publicationOptions = [
    { value: "all", label: "All Publication" },
    { value: "active", label: "Active" },
    { value: "draft", label: "Draft" }
  ];

  const filterFields: FilterField[] = [
    {
      id: "categoryId",
      label: "Category",
      value: query.categoryId ?? "all",
      options: categoryOptions
    },
    {
      id: "publication",
      label: "Publication",
      value: query.publication,
      options: publicationOptions
    }
  ];

  // Data Table Columns
  const columns: Column<Reward, RewardSortKey>[] = [
    {
      id: "title",
      header: "Reward & Merchant",
      sortKey: "title",
      cell: (r) => (
        <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontWeight: 700 }}>{r.title}</span>
            {r.tag && <Badge tone="gray">{r.tag}</Badge>}
          </div>
          <small style={{ color: "var(--muted)", fontSize: "12px" }}>
            {r.merchantName} · {r.description}
          </small>
        </div>
      )
    },
    {
      id: "category",
      header: "Category",
      cell: (r) => {
        const cat = categories.find((c) => c.id === r.categoryId);
        return <span>{cat?.label ?? r.categoryId}</span>;
      }
    },
    {
      id: "pointsCost",
      header: "Points Cost",
      sortKey: "pointsCost",
      cell: (r) => (
        <span style={{ fontWeight: 700, color: "var(--green)" }}>
          {r.pointsCost} <small style={{ fontWeight: 400 }}>pts</small>
        </span>
      )
    },
    {
      id: "expiresAt",
      header: "Expiry Date",
      sortKey: "expiresAt",
      cell: (r) => {
        const isExpired = new Date(r.expiresAt).getTime() <= Date.now();
        return (
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span>{formatDate(r.expiresAt)}</span>
            {isExpired && <Badge tone="red">Expired</Badge>}
          </div>
        );
      }
    },
    {
      id: "status",
      header: "Status",
      cell: (r) => (
        <Badge tone={r.isActive ? "green" : "gray"}>
          {r.isActive ? "Active" : "Draft"}
        </Badge>
      )
    },
    {
      id: "actions",
      header: "Actions",
      cell: (r) => (
        <div className="table-actions-group">
          <button
            type="button"
            className="table-action"
            onClick={() => handleOpenEdit(r.id)}
          >
            Edit
          </button>
          <button
            type="button"
            className="table-action"
            onClick={() => handleToggleActive(r)}
          >
            Set {r.isActive ? "draft" : "active"}
          </button>
          <button
            type="button"
            className="table-action danger"
            onClick={() => handleOpenDelete(r)}
          >
            Delete
          </button>
        </div>
      )
    }
  ];

  const rows = listQuery.data?.items ?? [];

  return (
    <div className="rewards-layout">
      {/* Header with Create Action */}
      <AdminPageHeader
        eyebrow="REWARDS PROGRAM"
        title="Rewards & vouchers"
        description="Manage the township resident redemption catalog, points costs, and merchant voucher availability."
        actions={
          <Button variant="primary" onClick={handleOpenCreate}>
            <Icon name="plus" size={16} /> Create voucher
          </Button>
        }
      />

      {pageFeedback && (
        <Feedback kind="success" onDismiss={() => setPageFeedback(null)}>
          {pageFeedback}
        </Feedback>
      )}

      {toggleMutation.error && (
        <Feedback kind="error" onDismiss={toggleMutation.clearError}>
          {toggleMutation.error}
        </Feedback>
      )}

      {/* Filter and Search Bar */}
      <SearchFilterBar
        search={query.search}
        searchLabel="Search rewards by title, merchant or description…"
        onSearchChange={handleSearchChange}
        filters={filterFields}
        onFilterChange={handleFilterChange}
        onReset={handleResetFilters}
      />

      {/* Data Table */}
      <DataTable
        caption="Rewards Catalog Table"
        rows={rows}
        columns={columns}
        getRowId={(r) => r.id}
        sort={query.sort}
        onSortChange={handleSortChange}
        loading={listQuery.loading}
        error={listQuery.error}
        onRetry={listQuery.reload}
        emptyTitle="No rewards found in this view"
      />

      {/* Pagination */}
      {listQuery.data && (
        <Pagination
          page={listQuery.data.page}
          pageSize={listQuery.data.pageSize}
          total={listQuery.data.total}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      )}

      {/* Create / Edit Modal Dialog */}
      <Modal
        open={isModalOpen}
        title={modalMode === "create" ? "Create Reward Voucher" : "Edit Reward Voucher"}
        closeDisabled={formMutation.pending}
        onClose={() => setIsModalOpen(false)}
        footer={
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", width: "100%" }}>
            <Button
              variant="ghost"
              disabled={formMutation.pending}
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              busy={formMutation.pending}
              onClick={() => void handleSubmitForm()}
            >
              {modalMode === "create" ? "Create voucher" : "Save changes"}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSubmitForm} className="voucher-form-grid" noValidate>
          {formMutation.error && (
            <div className="full-width">
              <Feedback kind="error" onDismiss={formMutation.clearError}>
                {formMutation.error}
              </Feedback>
            </div>
          )}

          <div className="full-width">
            <TextInput
              id="reward-title"
              label="Reward Title"
              value={formState.title}
              onChange={(val) => setFormState({ ...formState, title: val })}
              error={formErrors.title}
              required
              placeholder="e.g. RM5 café voucher"
            />
          </div>

          <div>
            <TextInput
              id="reward-merchant"
              label="Merchant Name"
              value={formState.merchantName}
              onChange={(val) => setFormState({ ...formState, merchantName: val })}
              error={formErrors.merchantName}
              required
              placeholder="e.g. Township Café"
            />
          </div>

          <div>
            <SelectInput
              id="reward-category"
              label="Category"
              value={formState.categoryId}
              options={categories.map((c) => ({ value: c.id, label: c.label }))}
              onChange={(val) => setFormState({ ...formState, categoryId: val })}
              error={formErrors.categoryId}
            />
          </div>

          <div className="full-width">
            <TextInput
              id="reward-description"
              label="Description"
              value={formState.description}
              onChange={(val) => setFormState({ ...formState, description: val })}
              error={formErrors.description}
              required
              placeholder="Illustrative demo reward details…"
            />
          </div>

          <div>
            <TextInput
              id="reward-points-cost"
              label="Points Required"
              type="number"
              min={1}
              value={formState.pointsCost}
              onChange={(val) => setFormState({ ...formState, pointsCost: val })}
              error={formErrors.pointsCost}
              required
              placeholder="e.g. 200"
            />
          </div>

          <div>
            <TextInput
              id="reward-expiry"
              label="Expiry Date"
              type="date"
              value={formState.expiresOn}
              onChange={(val) => setFormState({ ...formState, expiresOn: val })}
              error={formErrors.expiresOn}
              required
            />
          </div>

          <div>
            <TextInput
              id="reward-tag"
              label="Promotional Tag (Optional)"
              value={formState.tag}
              onChange={(val) => setFormState({ ...formState, tag: val })}
              placeholder="e.g. Popular, Food & drink"
            />
          </div>

          <div>
            <TextInput
              id="reward-max-redemptions"
              label="Max Redemptions Per Resident"
              type="number"
              min={1}
              value={formState.maxRedemptionsPerResident}
              onChange={(val) =>
                setFormState({ ...formState, maxRedemptionsPerResident: val })
              }
              error={formErrors.maxRedemptionsPerResident}
              required
            />
          </div>

          <div>
            <SelectInput
              id="reward-art-key"
              label="Card Art Theme"
              value={formState.artKey}
              options={ART_KEY_OPTIONS}
              onChange={(val) => setFormState({ ...formState, artKey: val })}
            />
          </div>

          <div>
            <TextInput
              id="reward-sort-order"
              label="Sort Priority"
              type="number"
              min={0}
              value={formState.sortOrder}
              onChange={(val) => setFormState({ ...formState, sortOrder: val })}
              error={formErrors.sortOrder}
            />
          </div>

          <div className="full-width">
            <TextInput
              id="reward-image-url"
              label="Image URL (HTTPS only, optional)"
              type="text"
              value={formState.imageUrl}
              onChange={(val) => setFormState({ ...formState, imageUrl: val })}
              error={formErrors.imageUrl}
              placeholder="https://images.example.com/voucher.jpg"
            />
          </div>

          <div className="full-width" style={{ marginTop: "4px" }}>
            <CheckboxInput
              id="reward-is-active"
              label="Publish to active resident rewards catalog immediately"
              checked={formState.isActive}
              onChange={(checked) => setFormState({ ...formState, isActive: checked })}
            />
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deletingReward !== null}
        title="Delete Reward Voucher"
        description={
          deletingReward
            ? `Are you sure you want to delete reward "${deletingReward.title}"? This action cannot be undone.`
            : ""
        }
        confirmLabel="Delete reward"
        variant="danger"
        busy={deleteMutation.pending}
        error={deleteMutation.error}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingReward(null)}
      />
    </div>
  );
}
