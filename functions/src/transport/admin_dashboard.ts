// =============================================================================
// admin_dashboard.ts — HTTPS callables for Admin Dashboard Analytics & Convergence
// Phase AB-09 — getAdminDashboard, rebuildAdminDashboard
// =============================================================================

import { onCall } from "firebase-functions/v2/https";
import { getComposition } from "../composition.js";
import { requireAdminCaller } from "./admin_guard.js";

export const getAdminDashboard = onCall(
  { region: "us-central1", invoker: "public" },
  async (request) => {
    await requireAdminCaller(request);
    return await getComposition().adminDashboard.getDashboard();
  }
);

export const rebuildAdminDashboard = onCall(
  { region: "us-central1", invoker: "public" },
  async (request) => {
    const { admin } = await requireAdminCaller(request);
    return await getComposition().adminDashboard.rebuildDashboard(admin.uid);
  }
);
