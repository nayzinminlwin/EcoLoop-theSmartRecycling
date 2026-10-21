// =============================================================================
// admin_queries_ab03.test.ts — Unit tests for Phase AB-03 Codecs, Pagination & Cursors
// =============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  decodeAdminBinView,
  decodeAdminBinDetailView,
  decodeAdminRewardView,
  decodeAdminRewardCategoryView,
  decodeAdminPaginatedResponse,
  adminBinViewToRow,
  adminRewardViewToReward,
  encodeCursor,
  decodeCursor,
  type AdminBinView,
  type AdminRewardView,
} from "../src/contracts/adminViewCodecs.ts";

describe("Phase AB-03 — Admin Bin View Codec", () => {
  it("decodes a valid bin view with proper defaults", () => {
    const raw = {
      binId: "bin-demo-01",
      locationName: "Central Station",
      locationDetail: "Platform 3",
      capacitySpc: 1000,
      occupiedSpc: 350,
      fillPercent: 35,
      cycleId: "cycle-bin-demo-01-001",
      enabled: true,
      logicalOnline: true,
      version: 1,
      sharedPolicyVersion: "v1.0.0",
      collectionState: "normal",
      lastCollectionTime: null,
      updatedAt: "2026-10-21T09:00:00.000Z",
    };

    const decoded = decodeAdminBinView(raw);
    assert.equal(decoded.binId, "bin-demo-01");
    assert.equal(decoded.locationName, "Central Station");
    assert.equal(decoded.fillPercent, 35);
    assert.equal(decoded.collectionState, "normal");
    assert.equal(decoded.lastCollectionTime, null);
  });

  it("converts Firestore _seconds timestamp objects to ISO strings", () => {
    const raw = {
      binId: "bin-timestamp",
      locationName: "Timestamp Hub",
      updatedAt: { _seconds: 1729500000 },
      lastCollectionTime: { _seconds: 1729490000 },
    };

    const decoded = decodeAdminBinView(raw);
    assert.match(decoded.updatedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    assert.match(decoded.lastCollectionTime!, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("clamps capacitySpc and fillPercent to valid ranges", () => {
    const raw = {
      binId: "bin-clamp",
      locationName: "Clamp Zone",
      capacitySpc: 10, // below min 50
      fillPercent: 150, // above max 100
    };

    const decoded = decodeAdminBinView(raw);
    assert.equal(decoded.capacitySpc, 50);
    assert.equal(decoded.fillPercent, 100);
  });

  it("rejects non-object or missing binId", () => {
    assert.throws(() => decodeAdminBinView(null), /expected an object/);
    assert.throws(() => decodeAdminBinView({ locationName: "No ID" }), /missing or invalid binId/);
  });

  it("decodes detail view with joined qr payload", () => {
    const detail = decodeAdminBinDetailView({
      bin: {
        binId: "bin-qr-detail",
        locationName: "Detail Hub",
      },
      qrPayload: "ecoloop://bin/qr-demo",
      totalCollections: 5,
      totalAcceptedItems: 120,
      activeAlertId: null,
    });

    assert.equal(detail.bin.binId, "bin-qr-detail");
    assert.equal(detail.qrPayload, "ecoloop://bin/qr-demo");
    assert.equal(detail.totalCollections, 5);
  });

  it("maps AdminBinView to UI SmartBinRow accurately", () => {
    const view: AdminBinView = {
      binId: "bin-mapped",
      locationName: "Mapped Park",
      locationDetail: "Gate 2",
      capacitySpc: 2000,
      occupiedSpc: 1600,
      fillPercent: 80,
      cycleId: "cycle-mapped-1",
      enabled: true,
      logicalOnline: true,
      version: 2,
      sharedPolicyVersion: "v1.0.0",
      collectionState: "warning",
      lastCollectionTime: "2026-10-20T10:00:00.000Z",
      updatedAt: "2026-10-21T08:00:00.000Z",
    };

    const row = adminBinViewToRow(view);
    assert.equal(row.bin.id, "bin-mapped");
    assert.equal(row.bin.capacityPercent, 80);
    assert.equal(row.bin.isOnline, true);
    assert.equal(row.operations.collectionStatus, "notScheduled");
  });
});

describe("Phase AB-03 — Admin Reward View Codec", () => {
  it("decodes a valid reward view", () => {
    const raw = {
      rewardId: "rew-cafe",
      title: "Free Coffee Voucher",
      description: "Enjoy one free beverage",
      merchantName: "Cyber Cafe",
      categoryId: "cat-fnb",
      categoryName: "Food & Beverage",
      pointsCost: 150,
      expiresAt: "2026-12-31T23:59:59.000Z",
      isActive: true,
      maxRedemptionsPerResident: 3,
      artKey: "art1",
      sortOrder: 1,
      isDemo: false,
      terms: "Valid on weekdays only",
      version: 1,
      updatedAt: "2026-10-21T09:00:00.000Z",
    };

    const decoded = decodeAdminRewardView(raw);
    assert.equal(decoded.rewardId, "rew-cafe");
    assert.equal(decoded.pointsCost, 150);
    assert.equal(decoded.artKey, "art1");
    assert.equal(decoded.isActive, true);
  });

  it("maps AdminRewardView to UI Reward model", () => {
    const view: AdminRewardView = {
      rewardId: "rew-grocer",
      title: "Grocery Discount",
      description: "RM 10 off groceries",
      merchantName: "Eco Mart",
      categoryId: "cat-retail",
      categoryName: "Retail",
      tag: "POPULAR",
      imageUrl: "https://example.com/art.png",
      pointsCost: 200,
      expiresAt: "2026-11-30T00:00:00.000Z",
      isActive: true,
      maxRedemptionsPerResident: 2,
      artKey: "art2",
      sortOrder: 5,
      isDemo: true,
      terms: "No cash refund",
      version: 1,
      updatedAt: "2026-10-21T08:00:00.000Z",
    };

    const reward = adminRewardViewToReward(view);
    assert.equal(reward.id, "rew-grocer");
    assert.equal(reward.categoryId, "cat-retail");
    assert.equal(reward.pointsCost, 200);
    assert.equal(reward.residentRedemptionCount, 0);
    assert.equal(reward.tag, "POPULAR");
  });

  it("decodes reward category view", () => {
    const cat = decodeAdminRewardCategoryView({
      categoryId: "cat-tech",
      categoryName: "Electronics",
      description: "Gadgets and tech rewards",
      sortOrder: 2,
    });
    assert.equal(cat.categoryId, "cat-tech");
    assert.equal(cat.categoryName, "Electronics");
    assert.equal(cat.sortOrder, 2);
  });
});

describe("Phase AB-03 — Paginated Envelopes & Cursors", () => {
  it("decodes empty feed correctly", () => {
    const res = decodeAdminPaginatedResponse(
      {
        schemaVersion: "admin.v1",
        items: [],
        total: 0,
        hasMore: false,
        nextCursor: null,
        readVersion: "1",
        freshness: "2026-10-21T09:00:00.000Z",
      },
      decodeAdminBinView
    );

    assert.equal(res.items.length, 0);
    assert.equal(res.total, 0);
    assert.equal(res.hasMore, false);
    assert.equal(res.nextCursor, null);
  });

  it("rejects future or unrecognized schemaVersion", () => {
    assert.throws(
      () =>
        decodeAdminPaginatedResponse(
          { schemaVersion: "admin.v2", items: [] },
          decodeAdminBinView
        ),
      /Unsupported schema version: admin.v2/
    );
  });

  it("encodes and decodes pagination cursor symmetrically", () => {
    const original = ["Central Station", "bin-001"];
    const encoded = encodeCursor(original);
    assert.ok(typeof encoded === "string");
    assert.ok(encoded.length > 0);

    const decoded = decodeCursor(encoded);
    assert.deepEqual(decoded, original);
  });

  it("preserves cursor stability across duplicate sort values", () => {
    // Two bins with identical fillPercent (50%)
    const cursor1 = encodeCursor([50, "bin-aaa"]);
    const cursor2 = encodeCursor([50, "bin-bbb"]);

    assert.notEqual(cursor1, cursor2);
    assert.deepEqual(decodeCursor(cursor1), [50, "bin-aaa"]);
    assert.deepEqual(decodeCursor(cursor2), [50, "bin-bbb"]);
  });
});
