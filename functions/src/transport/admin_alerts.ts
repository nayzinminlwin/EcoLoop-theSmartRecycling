// =============================================================================
// admin_alerts.ts — Transport HTTPS callables for capacity alerts & collection
// Phase AB-06 — Capacity alerts and collection-cycle workflow
// =============================================================================

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getComposition } from "../composition.js";
import { requireAdminCaller } from "./admin_guard.js";
import type { QueryPaginationInput } from "../infrastructure/firestore/admin_queries_store.js";
import type {
  ScheduleCollectionInput,
  RecordCollectionInput,
  ResolveCapacityAlertInput,
} from "../domain/admin_alerts.js";

export const listAdminAlerts = onCall(
  { region: "us-central1" },
  async (request) => {
    await requireAdminCaller(request);
    const data = (request.data ?? {}) as Record<string, unknown>;
    const payload = (data.payload ?? data) as QueryPaginationInput;

    const comp = getComposition();
    const versionRecord = await comp.adminReadVersions.getVersion("alerts");
    return await comp.adminQueries.listAlerts(payload, String(versionRecord.version));
  }
);

export const getAdminAlert = onCall(
  { region: "us-central1" },
  async (request) => {
    await requireAdminCaller(request);
    const data = (request.data ?? {}) as Record<string, unknown>;
    const payload = (data.payload ?? data) as { alertId?: string };

    const alertId = payload.alertId;
    if (!alertId || typeof alertId !== "string") {
      throw new HttpsError("invalid-argument", "alertId is required.");
    }

    const alert = await getComposition().adminQueries.getAlert(alertId);
    if (!alert) {
      throw new HttpsError("not-found", `Capacity alert "${alertId}" was not found.`);
    }

    return alert;
  }
);

export const adminScheduleCollection = onCall(
  { region: "us-central1" },
  async (request) => {
    const context = await requireAdminCaller(request);
    const data = (request.data ?? {}) as Record<string, unknown>;
    const payload = (data.payload ?? data) as ScheduleCollectionInput;

    const comp = getComposition();
    return await comp.adminAlerts.scheduleCollection(
      context.admin,
      payload,
      context.requestId,
      context.traceId,
      new Date().toISOString()
    );
  }
);

export const adminRecordCollection = onCall(
  { region: "us-central1" },
  async (request) => {
    const context = await requireAdminCaller(request);
    const data = (request.data ?? {}) as Record<string, unknown>;
    const payload = (data.payload ?? data) as RecordCollectionInput;

    const comp = getComposition();
    return await comp.adminAlerts.recordCollection(
      context.admin,
      payload,
      context.requestId,
      context.traceId,
      new Date().toISOString()
    );
  }
);

export const adminResolveCapacityAlert = onCall(
  { region: "us-central1" },
  async (request) => {
    const context = await requireAdminCaller(request);
    const data = (request.data ?? {}) as Record<string, unknown>;
    const payload = (data.payload ?? data) as ResolveCapacityAlertInput;

    const comp = getComposition();
    return await comp.adminAlerts.resolveCapacityAlert(
      context.admin,
      payload,
      context.requestId,
      context.traceId,
      new Date().toISOString()
    );
  }
);
