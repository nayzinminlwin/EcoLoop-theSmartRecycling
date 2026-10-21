// =============================================================================
// admin_rewards.ts — HTTPS callables for administrative reward catalog operations
// Phase AB-08 — Offer creation, versioned updates, and unused offer deletion
// =============================================================================

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getComposition } from "../composition.js";
import { requireAdminCaller } from "./admin_guard.js";
import type {
  CreateRewardOfferInput,
  UpdateRewardOfferInput,
  DeleteRewardOfferInput,
} from "../domain/admin_rewards.js";

function extractPayload<T>(data: unknown): { payload: T; requestId: string } {
  if (!data || typeof data !== "object") {
    throw new HttpsError("invalid-argument", "Missing command payload.");
  }

  const record = data as Record<string, unknown>;
  const requestId = String(record.requestId ?? `req-${Date.now()}`);
  const payload = (record.payload ?? record) as T;

  if (!payload || typeof payload !== "object") {
    throw new HttpsError("invalid-argument", "Invalid command payload.");
  }

  return { payload, requestId };
}

export const adminCreateReward = onCall(
  { region: "us-central1" },
  async (request) => {
    const { admin } = await requireAdminCaller(request);
    const { payload, requestId } = extractPayload<CreateRewardOfferInput>(request.data);

    return await getComposition().adminRewards.createReward({
      ...payload,
      caller: admin,
      requestId,
    });
  }
);
export const adminCreateRewardOffer = adminCreateReward;

export const adminUpdateReward = onCall(
  { region: "us-central1" },
  async (request) => {
    const { admin } = await requireAdminCaller(request);
    const { payload, requestId } = extractPayload<UpdateRewardOfferInput>(request.data);

    return await getComposition().adminRewards.updateReward({
      ...payload,
      caller: admin,
      requestId,
    });
  }
);
export const adminUpdateRewardOffer = adminUpdateReward;

export const adminDeleteUnusedReward = onCall(
  { region: "us-central1" },
  async (request) => {
    const { admin } = await requireAdminCaller(request);
    const { payload, requestId } = extractPayload<DeleteRewardOfferInput>(request.data);

    return await getComposition().adminRewards.deleteReward({
      ...payload,
      caller: admin,
      requestId,
    });
  }
);
export const adminDeleteRewardOffer = adminDeleteUnusedReward;
