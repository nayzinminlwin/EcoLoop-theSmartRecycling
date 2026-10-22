// =============================================================================
// admin_rewards.ts — Domain logic & validations for Reward Catalog Administration
// Phase AB-08 — Versioned reward-offer catalog management
// =============================================================================

import { DomainError } from "./errors.js";

export const ALLOWED_ART_KEYS = Object.freeze(["art0", "art1", "art2", "art3"] as const);
export type ArtKey = (typeof ALLOWED_ART_KEYS)[number];

export interface CreateRewardOfferInput {
  readonly title: string;
  readonly description: string;
  readonly merchantName: string;
  readonly categoryId: string;
  readonly tag?: string | null;
  readonly imageUrl?: string | null;
  readonly pointsCost: number;
  readonly expiresAt: string;
  readonly isActive: boolean;
  readonly maxRedemptionsPerResident: number;
  readonly artKey: ArtKey;
  readonly sortOrder: number;
  readonly terms?: string | null;
  readonly isDemo?: boolean;
}

export interface UpdateRewardOfferInput extends CreateRewardOfferInput {
  readonly rewardId: string;
  readonly expectedVersion: number;
}

export interface DeleteRewardOfferInput {
  readonly rewardId: string;
  readonly expectedVersion: number;
}

export function validateRewardId(id: unknown): string {
  if (typeof id !== "string" || !id.trim() || id.length > 64) {
    throw new DomainError("invalid_input", "A valid reward ID is required (1-64 chars).", {
      details: { field: "rewardId" },
    });
  }
  return id.trim();
}

export function validateRewardTitle(title: unknown): string {
  if (typeof title !== "string") {
    throw new DomainError("invalid_input", "Reward title must be a string.", {
      details: { field: "title" },
    });
  }
  const trimmed = title.trim();
  if (trimmed.length < 2 || trimmed.length > 100) {
    throw new DomainError("invalid_input", "Reward title must be between 2 and 100 characters.", {
      details: { field: "title" },
    });
  }
  return trimmed;
}

export function validateRewardDescription(desc: unknown): string {
  if (typeof desc !== "string") {
    throw new DomainError("invalid_input", "Reward description must be a string.", {
      details: { field: "description" },
    });
  }
  const trimmed = desc.trim();
  if (trimmed.length < 5 || trimmed.length > 300) {
    throw new DomainError("invalid_input", "Reward description must be between 5 and 300 characters.", {
      details: { field: "description" },
    });
  }
  return trimmed;
}

export function validateMerchantName(merchant: unknown): string {
  if (typeof merchant !== "string") {
    throw new DomainError("invalid_input", "Merchant name must be a string.", {
      details: { field: "merchantName" },
    });
  }
  const trimmed = merchant.trim();
  if (trimmed.length < 2 || trimmed.length > 100) {
    throw new DomainError("invalid_input", "Merchant name must be between 2 and 100 characters.", {
      details: { field: "merchantName" },
    });
  }
  return trimmed;
}

export function validateCategoryId(catId: unknown): string {
  if (typeof catId !== "string" || !catId.trim() || catId.length > 64) {
    throw new DomainError("invalid_input", "A valid category ID is required.", {
      details: { field: "categoryId" },
    });
  }
  return catId.trim();
}

export function validatePointsCost(cost: unknown): number {
  const num = Number(cost);
  if (!Number.isInteger(num) || num < 1) {
    throw new DomainError("invalid_input", "Points cost must be an integer >= 1.", {
      details: { field: "pointsCost" },
    });
  }
  return num;
}

export function validateMaxRedemptions(limit: unknown): number {
  if (limit === undefined || limit === null) return 1;
  const num = Number(limit);
  if (!Number.isInteger(num) || num < 1) {
    throw new DomainError("invalid_input", "Max redemptions per resident must be an integer >= 1.", {
      details: { field: "maxRedemptionsPerResident" },
    });
  }
  return num;
}

export function validateSortOrder(order: unknown): number {
  if (order === undefined || order === null) return 0;
  const num = Number(order);
  if (!Number.isInteger(num) || num < 0) {
    throw new DomainError("invalid_input", "Sort order must be an integer >= 0.", {
      details: { field: "sortOrder" },
    });
  }
  return num;
}

export function validateArtKey(key: unknown): ArtKey {
  if (typeof key !== "string" || !ALLOWED_ART_KEYS.includes(key as ArtKey)) {
    throw new DomainError("invalid_input", `Art key must be one of: ${ALLOWED_ART_KEYS.join(", ")}.`, {
      details: { field: "artKey" },
    });
  }
  return key as ArtKey;
}

export function validateImageUrl(url: unknown): string | null {
  if (url === null || url === undefined || url === "") {
    return null;
  }
  if (typeof url !== "string") {
    throw new DomainError("invalid_input", "Image URL must be a string.", {
      details: { field: "imageUrl" },
    });
  }
  const trimmed = url.trim();
  if (!trimmed) return null;

  if (!trimmed.startsWith("https://")) {
    throw new DomainError("invalid_input", "Image URL must use HTTPS.", {
      details: { field: "imageUrl" },
    });
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:") {
      throw new DomainError("invalid_input", "Image URL must use HTTPS protocol.", {
        details: { field: "imageUrl" },
      });
    }
    return trimmed;
  } catch {
    throw new DomainError("invalid_input", "Invalid image URL format.", {
      details: { field: "imageUrl" },
    });
  }
}

export function validateTerms(terms: unknown): string {
  if (terms === null || terms === undefined || terms === "") {
    return "Standard demo reward terms apply. Non-transferable. Valid for single resident redemption.";
  }
  if (typeof terms !== "string") {
    throw new DomainError("invalid_input", "Terms must be a string.", {
      details: { field: "terms" },
    });
  }
  const trimmed = terms.trim();
  if (trimmed.length > 500) {
    throw new DomainError("invalid_input", "Terms cannot exceed 500 characters.", {
      details: { field: "terms" },
    });
  }
  return trimmed || "Standard demo reward terms apply.";
}

/**
 * Normalizes date string into UTC ISO instant.
 * If given as 'YYYY-MM-DD', treats it as Malaysia (UTC+8) end-of-day: 23:59:59.999+08:00.
 */
export function normalizeMalaysiaExpiry(rawDate: string): string {
  if (!rawDate || typeof rawDate !== "string") {
    throw new DomainError("invalid_input", "Expiry date is required.", {
      details: { field: "expiresAt" },
    });
  }
  const trimmed = rawDate.trim();

  // If date-only format YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const myEndOfDay = `${trimmed}T23:59:59.999+08:00`;
    const parsed = new Date(myEndOfDay);
    if (isNaN(parsed.getTime())) {
      throw new DomainError("invalid_input", "Invalid date format for expiresAt.", {
        details: { field: "expiresAt" },
      });
    }
    return parsed.toISOString();
  }

  const parsed = new Date(trimmed);
  if (isNaN(parsed.getTime())) {
    throw new DomainError("invalid_input", "Invalid ISO timestamp for expiresAt.", {
      details: { field: "expiresAt" },
    });
  }
  return parsed.toISOString();
}

/**
 * Validates expiration date boundary.
 * - If isActive is true, requires expiresAt to be in the future.
 * - If isActive is false (draft or deactivating), permits past date without requiring a new future date.
 */
export function validateExpiryDate(
  rawExpiry: unknown,
  isActive: boolean,
  isDeactivating: boolean = false,
  nowMs: number = Date.now()
): string {
  if (typeof rawExpiry !== "string") {
    throw new DomainError("invalid_input", "Expiry date is required as a string.", {
      details: { field: "expiresAt" },
    });
  }
  const iso = normalizeMalaysiaExpiry(rawExpiry);
  const expiryMs = Date.parse(iso);

  if (isActive && expiryMs <= nowMs) {
    throw new DomainError(
      "invalid_input",
      "Cannot publish active reward offer with an expiration date in the past.",
      { details: { field: "expiresAt" } }
    );
  }

  // If deactivating an expired offer, past date is permitted.
  if (!isActive && !isDeactivating && expiryMs <= nowMs) {
    // Note: creating a draft with past date is warned or allowed, but for draft creation we still recommend valid dates.
  }

  return iso;
}
