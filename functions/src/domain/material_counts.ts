import type { ReceiptLine } from "./types.js";

export type AcceptedItemCounts = Record<"plastic" | "aluminium" | "paper" | "glass", number>;

const materialByClass: Partial<Record<ReceiptLine["class"], keyof AcceptedItemCounts>> = {
  plastic_bottle: "plastic",
  aluminium_can: "aluminium",
  glass_bottle: "glass",
  paper_item: "paper",
  paper_bag: "paper",
};

export function emptyAcceptedItemCounts(): AcceptedItemCounts {
  return { plastic: 0, aluminium: 0, paper: 0, glass: 0 };
}

export function acceptedItemCountsFromLines(lines: readonly ReceiptLine[]): AcceptedItemCounts {
  const counts = emptyAcceptedItemCounts();
  for (const line of lines) {
    if (!line.eligible) continue;
    const material = materialByClass[line.class];
    if (material !== undefined) counts[material] += line.count;
  }
  return counts;
}

export function addAcceptedItemCounts(
  existing: unknown,
  additions: AcceptedItemCounts,
): AcceptedItemCounts {
  const current = isAcceptedItemCounts(existing) ? existing : emptyAcceptedItemCounts();
  return {
    plastic: current.plastic + additions.plastic,
    aluminium: current.aluminium + additions.aluminium,
    paper: current.paper + additions.paper,
    glass: current.glass + additions.glass,
  };
}

function isAcceptedItemCounts(value: unknown): value is AcceptedItemCounts {
  if (typeof value !== "object" || value === null) return false;
  const counts = value as Record<string, unknown>;
  return ["plastic", "aluminium", "paper", "glass"].every(
    (key) => typeof counts[key] === "number" && Number.isFinite(counts[key]),
  );
}
