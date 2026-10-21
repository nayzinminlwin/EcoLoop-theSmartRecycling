import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getComposition } from "../composition.js";
import { requireAdminCaller } from "./admin_guard.js";

export const getAdminContext = onCall(
  { region: "us-central1" },
  async (request) => {
    const { admin } = await requireAdminCaller(request);
    const projectId = process.env.GCLOUD_PROJECT ?? "ecoloop-thesmartrecycling";
    const database = process.env.ECOLOOP_FIRESTORE_DATABASE ?? "ecoloop-db";
    const region = "us-central1";
    const backendMode = Boolean(process.env.FUNCTIONS_EMULATOR || process.env.FIREBASE_EMULATOR_HUB)
      ? "emulator"
      : "firebase";

    return {
      schemaVersion: "admin.v1",
      uid: admin.uid,
      email: admin.email,
      displayName: admin.displayName,
      role: "admin",
      enabled: admin.enabled,
      environment: {
        projectId,
        database,
        region,
        backendMode,
      },
      serverTime: new Date().toISOString(),
    };
  }
);

export const recoverAdminOperation = onCall(
  { region: "us-central1" },
  async (request) => {
    const { admin, traceId } = await requireAdminCaller(request);
    const data = request.data as Record<string, unknown> | undefined;
    const payload = data?.payload as Record<string, unknown> | undefined;
    const targetRequestId = (payload?.targetRequestId ?? data?.targetRequestId) as string | undefined;

    if (!targetRequestId || typeof targetRequestId !== "string") {
      throw new HttpsError("invalid-argument", "targetRequestId is required in payload.");
    }

    const receipt = await getComposition().adminOperations.getReceiptByRequestId(
      admin.uid,
      targetRequestId
    );

    if (!receipt) {
      throw new HttpsError(
        "not-found",
        `No committed operation found for request ID: ${targetRequestId}`
      );
    }

    return {
      ...receipt,
      traceId,
    };
  }
);
