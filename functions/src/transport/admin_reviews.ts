// =============================================================================
// admin_reviews.ts — Transport HTTPS callables for deposit verification & reviews
// Phase AB-07 — Evidence-backed review resolution and shared settlement
// =============================================================================

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getComposition } from "../composition.js";
import { requireAdminCaller } from "./admin_guard.js";
import type { QueryPaginationInput } from "../infrastructure/firestore/admin_queries_store.js";
import type {
  ReviewPreviewInput,
  ReviewResolutionInput,
} from "../domain/admin_reviews.js";

export const listAdminReviews = onCall(
  { region: "us-central1" },
  async (request) => {
    await requireAdminCaller(request);
    const data = (request.data ?? {}) as Record<string, unknown>;
    const payload = (data.payload ?? data) as QueryPaginationInput;

    const comp = getComposition();
    return await comp.adminQueries.listReviews(payload);
  }
);

export const getAdminReview = onCall(
  { region: "us-central1" },
  async (request) => {
    await requireAdminCaller(request);
    const data = (request.data ?? {}) as Record<string, unknown>;
    const payload = (data.payload ?? data) as { ticketId?: string };

    const ticketId = payload.ticketId;
    if (!ticketId || typeof ticketId !== "string") {
      throw new HttpsError("invalid-argument", "ticketId is required.");
    }

    const review = await getComposition().adminQueries.getReview(ticketId);
    if (!review) {
      throw new HttpsError("not-found", `Review ticket "${ticketId}" was not found.`);
    }

    return review;
  }
);

export const previewAdminReviewResolution = onCall(
  { region: "us-central1" },
  async (request) => {
    await requireAdminCaller(request);
    const data = (request.data ?? {}) as Record<string, unknown>;
    const payload = (data.payload ?? data) as ReviewPreviewInput;

    const comp = getComposition();
    return await comp.adminReviews.previewReviewResolution(payload);
  }
);

export const adminResolveReview = onCall(
  { region: "us-central1" },
  async (request) => {
    const context = await requireAdminCaller(request);
    const data = (request.data ?? {}) as Record<string, unknown>;
    const payload = (data.payload ?? data) as ReviewResolutionInput;

    const comp = getComposition();
    return await comp.adminReviews.resolveReview({
      ...payload,
      caller: context.admin,
      requestId: context.requestId,
    });
  }
);
