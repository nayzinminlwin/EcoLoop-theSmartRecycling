// =============================================================================
// admin_settings.ts — HTTPS callables for administrative settings & policy
// Phase AB-05 — Immutable program settings and future-policy publication
// =============================================================================

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getComposition } from "../composition.js";
import { requireAdminCaller } from "./admin_guard.js";
import type { PublishSettingsInput } from "../domain/admin_settings.js";

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

export const getAdminSettings = onCall(
  { region: "us-central1", invoker: "public" },
  async (request) => {
    await requireAdminCaller(request);
    return await getComposition().adminSettings.getSettings();
  }
);

export const adminPublishSettings = onCall(
  { region: "us-central1", invoker: "public" },
  async (request) => {
    const { admin, traceId } = await requireAdminCaller(request);
    const { payload, requestId } = extractPayload<PublishSettingsInput>(request.data);
    const nowInstant = new Date().toISOString();

    return await getComposition().adminSettings.publishSettings(
      admin,
      payload,
      requestId,
      traceId,
      nowInstant
    );
  }
);
