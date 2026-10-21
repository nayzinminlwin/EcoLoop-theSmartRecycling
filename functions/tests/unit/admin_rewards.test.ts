// =============================================================================
// admin_rewards.test.ts — Unit tests for Admin Reward Catalog Domain & Validations
// Phase AB-08 — Versioned reward-offer catalog management
// =============================================================================

import { describe, it, expect } from "vitest";
import {
  validateRewardId,
  validateRewardTitle,
  validateRewardDescription,
  validateMerchantName,
  validateCategoryId,
  validatePointsCost,
  validateMaxRedemptions,
  validateSortOrder,
  validateArtKey,
  validateImageUrl,
  validateTerms,
  normalizeMalaysiaExpiry,
  validateExpiryDate,
} from "../../src/domain/admin_rewards.js";
import { DomainError } from "../../src/domain/errors.js";

describe("Phase AB-08 — Admin Reward Catalog Domain & Validations", () => {
  it("validates reward ID format and bounds", () => {
    expect(validateRewardId("reward-101")).toBe("reward-101");
    expect(() => validateRewardId("")).toThrow(DomainError);
    expect(() => validateRewardId(null)).toThrow(DomainError);
  });

  it("validates reward title bounds (2 to 100 characters)", () => {
    expect(validateRewardTitle("Free Coffee")).toBe("Free Coffee");
    expect(() => validateRewardTitle("A")).toThrow(DomainError);
    expect(() => validateRewardTitle("   ")).toThrow(DomainError);
    expect(() => validateRewardTitle("A".repeat(101))).toThrow(DomainError);
  });

  it("validates description bounds (5 to 300 characters)", () => {
    expect(
      validateRewardDescription("Enjoy a fresh hot coffee at EcoLoop Cafe.")
    ).toBe("Enjoy a fresh hot coffee at EcoLoop Cafe.");
    expect(() => validateRewardDescription("Tiny")).toThrow(DomainError);
    expect(() => validateRewardDescription("A".repeat(301))).toThrow(DomainError);
  });

  it("validates merchant name bounds (2 to 100 characters)", () => {
    expect(validateMerchantName("EcoLoop Cafe")).toBe("EcoLoop Cafe");
    expect(() => validateMerchantName("")).toThrow(DomainError);
    expect(() => validateMerchantName("X")).toThrow(DomainError);
  });

  it("validates points cost is positive integer >= 1", () => {
    expect(validatePointsCost(50)).toBe(50);
    expect(validatePointsCost("100")).toBe(100);
    expect(() => validatePointsCost(0)).toThrow(DomainError);
    expect(() => validatePointsCost(-10)).toThrow(DomainError);
    expect(() => validatePointsCost(12.5)).toThrow(DomainError);
    expect(() => validatePointsCost("abc")).toThrow(DomainError);
  });

  it("validates max redemptions and sort order integers", () => {
    expect(validateMaxRedemptions(1)).toBe(1);
    expect(validateMaxRedemptions(5)).toBe(5);
    expect(validateMaxRedemptions(undefined)).toBe(1);
    expect(() => validateMaxRedemptions(0)).toThrow(DomainError);

    expect(validateSortOrder(0)).toBe(0);
    expect(validateSortOrder(10)).toBe(10);
    expect(validateSortOrder(undefined)).toBe(0);
    expect(() => validateSortOrder(-1)).toThrow(DomainError);
  });

  it("validates art key against canonical options (art0, art1, art2, art3)", () => {
    expect(validateArtKey("art0")).toBe("art0");
    expect(validateArtKey("art1")).toBe("art1");
    expect(validateArtKey("art2")).toBe("art2");
    expect(validateArtKey("art3")).toBe("art3");
    expect(() => validateArtKey("art99")).toThrow(DomainError);
    expect(() => validateArtKey("custom")).toThrow(DomainError);
  });

  it("validates image URL requires HTTPS and valid URI syntax", () => {
    expect(validateImageUrl(null)).toBeNull();
    expect(validateImageUrl("")).toBeNull();
    expect(validateImageUrl("https://cdn.example.com/voucher.jpg")).toBe(
      "https://cdn.example.com/voucher.jpg"
    );
    expect(() => validateImageUrl("http://insecure.com/img.jpg")).toThrow(DomainError);
    expect(() => validateImageUrl("javascript:alert(1)")).toThrow(DomainError);
    expect(() => validateImageUrl("https://")).toThrow(DomainError);
  });

  it("validates terms default and length limit", () => {
    expect(validateTerms(null)).toContain("Standard demo reward terms apply");
    expect(validateTerms("Valid on weekdays only.")).toBe("Valid on weekdays only.");
    expect(() => validateTerms("A".repeat(501))).toThrow(DomainError);
  });

  it("normalizes Malaysia date (YYYY-MM-DD) to UTC ISO end-of-day boundary", () => {
    const normalized = normalizeMalaysiaExpiry("2026-12-31");
    expect(normalized.endsWith("Z")).toBe(true);
    // 2026-12-31 23:59:59.999 +08:00 is 2026-12-31 15:59:59.999Z
    const d = new Date(normalized);
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(11);
    expect(d.getUTCDate()).toBe(31);
    expect(d.getUTCHours()).toBe(15);
  });

  it("enforces expiration rules: active rejects past, deactivating permits past", () => {
    const pastDate = "2020-01-01";
    const futureDate = "2030-01-01";

    // Active with past date -> throws
    expect(() => validateExpiryDate(pastDate, true, false, Date.now())).toThrow(DomainError);

    // Active with future date -> succeeds
    const validFuture = validateExpiryDate(futureDate, true, false, Date.now());
    expect(validFuture.startsWith("2029-12-31") || validFuture.startsWith("2030-01-01")).toBe(true);

    // Deactivating with past date -> succeeds without requiring new date
    const deactivatedPast = validateExpiryDate(pastDate, false, true, Date.now());
    expect(Boolean(deactivatedPast)).toBe(true);
  });
});
