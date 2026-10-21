// =============================================================================
// admin_dashboard.ts — Domain logic & calculations for Admin Dashboard Analytics
// Phase AB-09 — Material mix, 7-day activity window, and attention bin classification
// =============================================================================

export const KG_PER_PIECE: Readonly<Record<string, number>> = Object.freeze({
  plastic_bottle: 0.025,
  plastic: 0.025,
  aluminium_can: 0.015,
  aluminium: 0.015,
  paper_item: 0.050,
  paper_bag: 0.050,
  paper: 0.050,
  glass_bottle: 0.200,
  glass: 0.200,
  // Cardboard is excluded by policy and contributes zero verified impact
  cardboard_item: 0.0,
  other: 0.0,
  unknown: 0.0,
});

export type CanonicalMaterialType = "plastic" | "aluminium" | "paper" | "glass" | "unknown";

export function mapClassToMaterialType(rawClass: string): CanonicalMaterialType {
  const normalized = rawClass.toLowerCase().trim();
  if (normalized.includes("plastic")) return "plastic";
  if (normalized.includes("aluminium") || normalized.includes("aluminum") || normalized.includes("can")) return "aluminium";
  if (normalized.includes("paper") || normalized.includes("bag")) return "paper";
  if (normalized.includes("glass")) return "glass";
  return "unknown";
}

/**
 * Returns the calendar date (YYYY-MM-DD) in Asia/Kuala_Lumpur timezone.
 */
export function getMalaysiaDate(instantOrMs: string | number | Date = new Date()): string {
  const date = typeof instantOrMs === "string" || typeof instantOrMs === "number"
    ? new Date(instantOrMs)
    : instantOrMs;

  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date input for getMalaysiaDate: ${String(instantOrMs)}`);
  }

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(date);
}

/**
 * Returns the dynamic 7-day activity window ending on today's Malaysia date.
 * [today - 6 days, ..., today]
 */
export function getSevenDayMalaysiaWindow(nowMs: number = Date.now()): string[] {
  const dates: string[] = [];
  const oneDayMs = 24 * 60 * 60 * 1000;
  for (let i = 6; i >= 0; i--) {
    dates.push(getMalaysiaDate(nowMs - i * oneDayMs));
  }
  return dates;
}

export interface MaterialCountEntry {
  readonly materialType: CanonicalMaterialType;
  readonly itemCount: number;
}

export interface MaterialMixResult {
  readonly materialType: CanonicalMaterialType;
  readonly itemCount: number;
  readonly weightKg: number;
  readonly percentage: number;
}

/**
 * Computes material mix and weight distributions from item counts.
 */
export function calculateMaterialMix(counts: Record<CanonicalMaterialType, number>): {
  readonly items: MaterialMixResult[];
  readonly totalWeightKg: number;
  readonly totalItems: number;
} {
  const types: CanonicalMaterialType[] = ["plastic", "aluminium", "paper", "glass"];

  let totalWeightKg = 0;
  let totalItems = 0;
  const weights: Record<CanonicalMaterialType, number> = {
    plastic: 0,
    aluminium: 0,
    paper: 0,
    glass: 0,
    unknown: 0,
  };

  for (const t of types) {
    const count = counts[t] ?? 0;
    const kg = count * (KG_PER_PIECE[t] ?? 0);
    weights[t] = kg;
    totalWeightKg += kg;
    totalItems += count;
  }

  // Round total weight to 3 decimal places
  totalWeightKg = Math.round(totalWeightKg * 1000) / 1000;

  const items: MaterialMixResult[] = types.map((t) => {
    const count = counts[t] ?? 0;
    const weightKg = Math.round(weights[t] * 1000) / 1000;
    const percentage = totalWeightKg > 0 ? Math.round((weights[t] / totalWeightKg) * 100) : 0;
    return {
      materialType: t,
      itemCount: count,
      weightKg,
      percentage,
    };
  });

  return { items, totalWeightKg, totalItems };
}

export interface AttentionBinCandidate {
  readonly binId: string;
  readonly locationName: string;
  readonly fillPercent: number;
  readonly collectionState: "normal" | "warning" | "critical" | "collection_pending";
  readonly enabled?: boolean;
  readonly logicalOnline?: boolean;
  readonly hasActiveAlert?: boolean;
}

/**
 * Filters and deterministically sorts attention bins:
 * 1. Collection required (critical / collection_pending / active alert)
 * 2. High capacity (warning / fillPercent >= 75)
 * 3. Offline / disabled
 * 4. Deterministic tie-breaking on binId
 */
export function classifyAttentionBins(
  candidates: readonly AttentionBinCandidate[],
  thresholdPercent: number = 80,
  maxResults: number = 10
): AttentionBinCandidate[] {
  const needsAttention = candidates.filter((b) => {
    if (b.enabled === false) return true;
    if (b.logicalOnline === false) return true;
    if (b.hasActiveAlert) return true;
    if (b.collectionState !== "normal") return true;
    if (b.fillPercent >= 75 || b.fillPercent >= thresholdPercent) return true;
    return false;
  });

  const getPriority = (b: AttentionBinCandidate): number => {
    if (b.collectionState === "critical" || b.collectionState === "collection_pending" || b.hasActiveAlert) {
      return 1;
    }
    if (b.fillPercent >= 85) return 2;
    if (b.fillPercent >= 75 || b.collectionState === "warning") return 3;
    if (b.enabled === false || b.logicalOnline === false) return 4;
    return 5;
  };

  const sorted = [...needsAttention].sort((a, b) => {
    const prioDiff = getPriority(a) - getPriority(b);
    if (prioDiff !== 0) return prioDiff;
    const fillDiff = b.fillPercent - a.fillPercent;
    if (fillDiff !== 0) return fillDiff;
    return a.binId.localeCompare(b.binId);
  });

  return sorted.slice(0, maxResults);
}
