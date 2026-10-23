// =============================================================================
// admin_dashboard.test.ts — Unit tests for Admin Dashboard Domain & Analytics
// Phase AB-09 — Dashboard accounting, 7-day activity window, and material mix
// =============================================================================

import { describe, it, expect } from "vitest";
import {
  KG_PER_PIECE,
  mapClassToMaterialType,
  getMalaysiaDate,
  getSevenDayMalaysiaWindow,
  calculateMaterialMix,
  classifyAttentionBins,
  type AttentionBinCandidate,
} from "../../src/domain/admin_dashboard.js";

describe("Phase AB-09 — Admin Dashboard Domain & Analytics", () => {
  it("defines standard display weights per recyclable piece and excludes cardboard", () => {
    expect(KG_PER_PIECE.plastic_bottle).toBe(0.025);
    expect(KG_PER_PIECE.plastic).toBe(0.025);
    expect(KG_PER_PIECE.aluminium_can).toBe(0.015);
    expect(KG_PER_PIECE.aluminium).toBe(0.015);
    expect(KG_PER_PIECE.paper_item).toBe(0.050);
    expect(KG_PER_PIECE.paper_bag).toBe(0.050);
    expect(KG_PER_PIECE.paper).toBe(0.050);
    expect(KG_PER_PIECE.glass_bottle).toBe(0.200);
    expect(KG_PER_PIECE.glass).toBe(0.200);
    // Excluded cardboard contributes zero verified impact
    expect(KG_PER_PIECE.cardboard_item).toBe(0.0);
  });

  it("maps detected and canonical classes accurately to canonical material types", () => {
    expect(mapClassToMaterialType("plastic_bottle")).toBe("plastic");
    expect(mapClassToMaterialType("aluminium_can")).toBe("aluminium");
    expect(mapClassToMaterialType("aluminum_can")).toBe("aluminium");
    expect(mapClassToMaterialType("paper_item")).toBe("paper");
    expect(mapClassToMaterialType("paper_bag")).toBe("paper");
    expect(mapClassToMaterialType("glass_bottle")).toBe("glass");
    expect(mapClassToMaterialType("cardboard_item")).toBe("unknown");
    expect(mapClassToMaterialType("other")).toBe("unknown");
  });

  it("formats dates in Malaysia timezone (Asia/Kuala_Lumpur, UTC+8)", () => {
    // 2026-10-21 02:00:00 UTC is 2026-10-21 10:00:00 in Malaysia
    const d1 = "2026-10-21T02:00:00.000Z";
    expect(getMalaysiaDate(d1)).toBe("2026-10-21");

    // 2026-10-20 20:00:00 UTC is 2026-10-21 04:00:00 in Malaysia (+8h cross-midnight)
    const d2 = "2026-10-20T20:00:00.000Z";
    expect(getMalaysiaDate(d2)).toBe("2026-10-21");

    // 2026-10-20 15:00:00 UTC is 2026-10-20 23:00:00 in Malaysia
    const d3 = "2026-10-20T15:00:00.000Z";
    expect(getMalaysiaDate(d3)).toBe("2026-10-20");
  });

  it("generates a dynamic 7-day activity window ending on today's Malaysia date", () => {
    // Reference: 2026-10-21 12:00:00 UTC+8
    const refMs = Date.parse("2026-10-21T12:00:00+08:00");
    const window = getSevenDayMalaysiaWindow(refMs);

    expect(window).toHaveLength(7);
    expect(window[6]).toBe("2026-10-21");
    expect(window[5]).toBe("2026-10-20");
    expect(window[4]).toBe("2026-10-19");
    expect(window[3]).toBe("2026-10-18");
    expect(window[2]).toBe("2026-10-17");
    expect(window[1]).toBe("2026-10-16");
    expect(window[0]).toBe("2026-10-15");
  });

  it("calculates exact exit gate scenario: 2 plastic + 3 aluminium + 1 paper = 6 items, 0.145 kg", () => {
    // 2 plastic: 2 * 0.025 = 0.050 kg
    // 3 aluminium: 3 * 0.015 = 0.045 kg
    // 1 paper: 1 * 0.050 = 0.050 kg
    // Total weight = 0.050 + 0.045 + 0.050 = 0.145 kg
    const counts = {
      plastic: 2,
      aluminium: 3,
      paper: 1,
      glass: 0,
      unknown: 0,
    };

    const res = calculateMaterialMix(counts);
    expect(res.totalItems).toBe(6);
    expect(res.totalWeightKg).toBe(0.145);

    const plasticMix = res.items.find((m) => m.materialType === "plastic")!;
    expect(plasticMix.weightKg).toBe(0.05);
    // 0.05 / 0.145 * 100 = 34.48% -> 34%
    expect(plasticMix.percentage).toBe(34);

    const alumMix = res.items.find((m) => m.materialType === "aluminium")!;
    expect(alumMix.weightKg).toBe(0.045);
    // 0.045 / 0.145 * 100 = 31.03% -> 31%
    expect(alumMix.percentage).toBe(31);

    const paperMix = res.items.find((m) => m.materialType === "paper")!;
    expect(paperMix.weightKg).toBe(0.05);
    // 0.05 / 0.145 * 100 = 34.48% -> 34%
    expect(paperMix.percentage).toBe(34);
  });

  it("classifies and deterministically prioritizes attention bins", () => {
    const bins: AttentionBinCandidate[] = [
      {
        binId: "bin-normal-low",
        locationName: "Normal Low",
        fillPercent: 30,
        collectionState: "normal",
        enabled: true,
        logicalOnline: true,
      },
      {
        binId: "bin-warning-78",
        locationName: "Warning 78",
        fillPercent: 78,
        collectionState: "warning",
        enabled: true,
        logicalOnline: true,
      },
      {
        binId: "bin-critical-alert",
        locationName: "Critical Alert",
        fillPercent: 88,
        collectionState: "critical",
        enabled: true,
        logicalOnline: true,
        hasActiveAlert: true,
      },
      {
        binId: "bin-offline",
        locationName: "Offline Bin",
        fillPercent: 40,
        collectionState: "normal",
        enabled: true,
        logicalOnline: false,
      },
    ];

    const classified = classifyAttentionBins(bins, 80, 10);
    expect(classified).toHaveLength(3);

    // Critical/Alert bin comes first
    expect(classified[0].binId).toBe("bin-critical-alert");
    // Warning high fill comes next
    expect(classified[1].binId).toBe("bin-warning-78");
    // Offline bin comes next
    expect(classified[2].binId).toBe("bin-offline");
  });
});
