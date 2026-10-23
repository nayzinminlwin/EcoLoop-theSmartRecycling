// =============================================================================
// admin_bins.ts — HTTPS callables for administrative bin fleet operations
// Phase AB-04 — Creation, updates, safe deletion of unused bins, and QR code export
// =============================================================================

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getComposition } from "../composition.js";
import { requireAdminCaller } from "./admin_guard.js";
import type {
  CreateBinInput,
  UpdateBinInput,
  DeleteBinInput,
} from "../domain/admin_bins.js";

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

export const adminCreateBin = onCall(
  { region: "us-central1", invoker: "public" },
  async (request) => {
    const { admin, traceId } = await requireAdminCaller(request);
    const { payload, requestId } = extractPayload<CreateBinInput>(request.data);
    const nowInstant = new Date().toISOString();

    return await getComposition().adminBins.createBin(
      admin,
      payload,
      requestId,
      traceId,
      nowInstant
    );
  }
);

export const adminUpdateBin = onCall(
  { region: "us-central1", invoker: "public" },
  async (request) => {
    const { admin, traceId } = await requireAdminCaller(request);
    const { payload, requestId } = extractPayload<UpdateBinInput>(request.data);
    const nowInstant = new Date().toISOString();

    return await getComposition().adminBins.updateBin(
      admin,
      payload,
      requestId,
      traceId,
      nowInstant
    );
  }
);

export const adminDeleteUnusedBin = onCall(
  { region: "us-central1", invoker: "public" },
  async (request) => {
    const { admin, traceId } = await requireAdminCaller(request);
    const { payload, requestId } = extractPayload<DeleteBinInput>(request.data);
    const nowInstant = new Date().toISOString();

    return await getComposition().adminBins.deleteUnusedBin(
      admin,
      payload,
      requestId,
      traceId,
      nowInstant
    );
  }
);

export const getAdminBinQr = onCall(
  { region: "us-central1", invoker: "public" },
  async (request) => {
    const { admin } = await requireAdminCaller(request);
    const data = request.data as Record<string, unknown> | undefined;
    const binId = String(data?.binId ?? data?.id ?? "");

    if (!binId) {
      throw new HttpsError("invalid-argument", "binId is required.");
    }

    return await getComposition().adminBins.getBinQr(admin, binId);
  }
);
