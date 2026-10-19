import type { WorkerFindings, Instant } from "../domain/types.js";
import type {
  FinalizeInspectionInput,
  SettlementResult,
  SettlementStore,
} from "../infrastructure/firestore/settlement_store.js";
import type { WorkerIdentity } from "../infrastructure/firestore/jobs_store.js";

export function finalizeInspection(
  store: SettlementStore,
  input: Omit<FinalizeInspectionInput, "identity"> & { identity: WorkerIdentity },
): Promise<SettlementResult> {
  return store.finalizeInspection(input);
}

export function resolveReview(
  store: SettlementStore,
  input: {
    readonly batchId: string;
    readonly decisionVersion: number;
    readonly findings: WorkerFindings;
    readonly now: Instant;
    readonly actorId: string;
  },
): Promise<SettlementResult> {
  return store.resolveReview(input);
}
