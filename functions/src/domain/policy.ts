import type {
  CanonicalClass,
  DepositBatch,
  Eligibility,
  ReceiptLine,
  WorkerFinding,
} from "./types.js";

export interface PolicySnapshot {
  readonly id: string;
  readonly acceptedObjectClasses: readonly CanonicalClass[];
  readonly rewardCategoryByClass: Readonly<Partial<Record<CanonicalClass, string>>>;
  readonly pointsPerItemByCategory: Readonly<Record<string, number>>;
  readonly spcPerItemByClass: Readonly<Partial<Record<CanonicalClass, number>>>;
  readonly defaultSpcPerRecognizedItem: number;
  readonly unresolvedSpcPerCandidate: number;
  readonly unreadableBatchSpc: number;
}

export interface FinalizationPlan {
  readonly status: DepositBatch["status"];
  readonly totalDetectedObjectCount: number | null;
  readonly pointsAwarded: number | null;
  readonly spaceContributionSpc: number;
  readonly lines: readonly ReceiptLine[];
  readonly acceptedCount: number | null;
  readonly reasonCodes: readonly string[];
  readonly policyVersion: string;
}

const acceptedClasses: readonly CanonicalClass[] = Object.freeze([
  "plastic_bottle",
  "aluminium_can",
  "glass_bottle",
  "paper_item",
  "paper_bag",
]);

const INITIAL_POLICY: PolicySnapshot = Object.freeze({
  id: "policy-v1",
  acceptedObjectClasses: acceptedClasses,
  rewardCategoryByClass: Object.freeze({
    plastic_bottle: "plastic",
    aluminium_can: "aluminium",
    glass_bottle: "glass",
    paper_item: "paper",
    paper_bag: "paper",
    cardboard_item: "paper",
  }),
  pointsPerItemByCategory: Object.freeze({
    plastic: 5,
    aluminium: 8,
    paper: 3,
    glass: 10,
  }),
  spcPerItemByClass: Object.freeze({
    plastic_bottle: 10,
    aluminium_can: 6,
    glass_bottle: 12,
    paper_item: 2,
    paper_bag: 8,
    cardboard_item: 15,
  }),
  defaultSpcPerRecognizedItem: 10,
  unresolvedSpcPerCandidate: 10,
  unreadableBatchSpc: 50,
});

export function initialPolicy(): PolicySnapshot {
  return INITIAL_POLICY;
}

function isEligible(policy: PolicySnapshot, finding: WorkerFinding): boolean {
  return finding.eligibility === "eligible" &&
    policy.acceptedObjectClasses.includes(finding.resolution);
}

function classLine(policy: PolicySnapshot, resolution: CanonicalClass, findings: readonly WorkerFinding[]): ReceiptLine {
  const count = findings.length;
  const eligible = findings.every((finding) => isEligible(policy, finding));
  const category = policy.rewardCategoryByClass[resolution];
  const pointsPerItem = eligible && category !== undefined
    ? policy.pointsPerItemByCategory[category] ?? 0
    : 0;
  const hasUnresolvedFinding = findings.some(
    (finding) => finding.eligibility === "unresolved" || finding.resolution === "unknown",
  );
  const spacePerItem = hasUnresolvedFinding
    ? 0
    : policy.spcPerItemByClass[resolution] ?? policy.defaultSpcPerRecognizedItem;
  return {
    lineId: `line-${resolution}`,
    class: resolution,
    eligible,
    count,
    pointsPerItem,
    spacePerItem,
    points: count * pointsPerItem,
    spaceSpc: count * spacePerItem,
  };
}

export function calculateFinalization(
  policy: PolicySnapshot,
  inventoryState: "resolved" | "empty" | "unreadable" | "uncertain",
  findings: readonly WorkerFinding[],
): FinalizationPlan {
  if (inventoryState === "unreadable") {
    return {
      status: "review",
      totalDetectedObjectCount: null,
      pointsAwarded: null,
      spaceContributionSpc: policy.unreadableBatchSpc,
      lines: [],
      acceptedCount: null,
      reasonCodes: ["unreadable_inventory"],
      policyVersion: policy.id,
    };
  }
  if (inventoryState === "empty") {
    return {
      status: "empty",
      totalDetectedObjectCount: 0,
      pointsAwarded: 0,
      spaceContributionSpc: 0,
      lines: [],
      acceptedCount: 0,
      reasonCodes: [],
      policyVersion: policy.id,
    };
  }

  const grouped = new Map<CanonicalClass, WorkerFinding[]>();
  for (const finding of findings) {
    if (finding.reasonCode === "false_detection") continue;
    const group = grouped.get(finding.resolution) ?? [];
    group.push(finding);
    grouped.set(finding.resolution, group);
  }
  const validFindings = findings.filter((finding) => finding.reasonCode !== "false_detection");
  const lines = [...grouped.entries()]
    .map(([resolution, group]) => classLine(policy, resolution, group))
    .sort((left, right) => left.class.localeCompare(right.class));
  const unresolvedCount = validFindings.filter(
    (finding) => finding.eligibility === "unresolved" || finding.resolution === "unknown",
  ).length;
  const acceptedCount = lines
    .filter((line) => line.eligible)
    .reduce((total, line) => total + line.count, 0);
  const spaceContributionSpc = lines.reduce((total, line) => total + line.spaceSpc, 0) +
    unresolvedCount * policy.unresolvedSpcPerCandidate;
  const hasUnresolved = inventoryState === "uncertain" || unresolvedCount > 0;
  return {
    status: hasUnresolved ? "review" : (acceptedCount === 0 ? "rejected" : "verified"),
    totalDetectedObjectCount: validFindings.length,
    pointsAwarded: hasUnresolved ? null : lines.reduce((total, line) => total + line.points, 0),
    spaceContributionSpc,
    lines,
    acceptedCount,
    reasonCodes: hasUnresolved ? ["material_uncertainty"] : [],
    policyVersion: policy.id,
  };
}
