// =============================================================================
// admin_queries.ts — Administrative query HTTPS callables
// Phase AB-03 — listAdminBins, getAdminBin, listAdminRewards, getAdminReward, getAdminRewardCategories
// =============================================================================

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getComposition } from "../composition.js";
import { requireAdminCaller } from "./admin_guard.js";
import type { QueryPaginationInput } from "../infrastructure/firestore/admin_queries_store.js";

export const listAdminBins = onCall(
  { region: "us-central1", invoker: "public" },
  async (request) => {
    await requireAdminCaller(request);
    const data = (request.data ?? {}) as Record<string, unknown>;
    const payload = (data.payload ?? data) as QueryPaginationInput;

    const comp = getComposition();
    const versionRecord = await comp.adminReadVersions.getVersion("bins");
    return await comp.adminQueries.listBins(payload, String(versionRecord.version));
  }
);

export const getAdminBin = onCall(
  { region: "us-central1", invoker: "public" },
  async (request) => {
    await requireAdminCaller(request);
    const data = (request.data ?? {}) as Record<string, unknown>;
    const payload = (data.payload ?? data) as { binId?: string };

    const binId = payload.binId;
    if (!binId || typeof binId !== "string") {
      throw new HttpsError("invalid-argument", "binId is required.");
    }

    const detail = await getComposition().adminQueries.getBin(binId);
    if (!detail) {
      throw new HttpsError("not-found", `Smart bin "${binId}" was not found.`);
    }

    return detail;
  }
);

export const listAdminRewards = onCall(
  { region: "us-central1", invoker: "public" },
  async (request) => {
    await requireAdminCaller(request);
    const data = (request.data ?? {}) as Record<string, unknown>;
    const payload = (data.payload ?? data) as QueryPaginationInput;

    const comp = getComposition();
    const versionRecord = await comp.adminReadVersions.getVersion("rewards");
    return await comp.adminQueries.listRewards(payload, String(versionRecord.version));
  }
);

export const getAdminReward = onCall(
  { region: "us-central1", invoker: "public" },
  async (request) => {
    await requireAdminCaller(request);
    const data = (request.data ?? {}) as Record<string, unknown>;
    const payload = (data.payload ?? data) as { rewardId?: string };

    const rewardId = payload.rewardId;
    if (!rewardId || typeof rewardId !== "string") {
      throw new HttpsError("invalid-argument", "rewardId is required.");
    }

    const reward = await getComposition().adminQueries.getReward(rewardId);
    if (!reward) {
      throw new HttpsError("not-found", `Reward offer "${rewardId}" was not found.`);
    }

    return reward;
  }
);

export const getAdminRewardCategories = onCall(
  { region: "us-central1", invoker: "public" },
  async (request) => {
    await requireAdminCaller(request);
    return await getComposition().adminQueries.getRewardCategories();
  }
);
