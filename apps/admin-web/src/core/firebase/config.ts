/// <reference types="vite/client" />
/// <reference path="../../vite-env.d.ts" />
// =============================================================================
// config.ts — Admin portal Firebase environment and runtime configuration
// Phase AB-02 — Explicit backend mode resolution and environment validation
// =============================================================================

export type BackendMode = "mock" | "emulator" | "firebase";

export interface FirebaseClientConfig {
  readonly mode: BackendMode;
  readonly projectId: string;
  readonly database: string;
  readonly region: string;
  readonly apiKey?: string;
  readonly authDomain?: string;
  readonly storageBucket?: string;
  readonly messagingSenderId?: string;
  readonly appId?: string;
  readonly appCheckSiteKey?: string;
  readonly authEmulatorUrl?: string;
  readonly firestoreEmulatorHost?: string;
  readonly firestoreEmulatorPort?: number;
  readonly functionsEmulatorHost?: string;
  readonly functionsEmulatorPort?: number;
}

function getEnv(): Record<string, string | undefined> {
  const meta = import.meta as unknown as { env?: Record<string, string | undefined> };
  if (meta && typeof meta === "object" && meta.env) {
    return meta.env;
  }
  if (typeof process !== "undefined" && process.env) {
    return process.env;
  }
  return {};
}

function resolveBackendMode(rawMode?: string): BackendMode {
  if (rawMode === "firebase" || rawMode === "emulator" || rawMode === "mock") {
    return rawMode;
  }
  const meta = import.meta as unknown as { env?: { PROD?: boolean } };
  if (meta?.env?.PROD) {
    return "firebase";
  }
  return "mock";
}

export function loadFirebaseConfig(): FirebaseClientConfig {
  const env = getEnv();
  const mode = resolveBackendMode(env.VITE_ECOLOOP_BACKEND_MODE);
  const projectId = env.VITE_ECOLOOP_FIREBASE_PROJECT_ID || "ecoloop-thesmartrecycling";
  const database = env.VITE_ECOLOOP_FIRESTORE_DATABASE || "ecoloop-db";
  const region = env.VITE_ECOLOOP_FIREBASE_REGION || "us-central1";

  // Parse emulator ports
  const firestorePortStr = env.VITE_ECOLOOP_FIRESTORE_EMULATOR_PORT;
  const functionsPortStr = env.VITE_ECOLOOP_FUNCTIONS_EMULATOR_PORT;

  const config: FirebaseClientConfig = {
    mode,
    projectId,
    database,
    region,
    apiKey: env.VITE_ECOLOOP_FIREBASE_API_KEY,
    authDomain: env.VITE_ECOLOOP_FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`,
    storageBucket: env.VITE_ECOLOOP_FIREBASE_STORAGE_BUCKET || `${projectId}.firebasestorage.app`,
    messagingSenderId: env.VITE_ECOLOOP_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_ECOLOOP_FIREBASE_APP_ID,
    appCheckSiteKey: env.VITE_ECOLOOP_APP_CHECK_SITE_KEY,
    authEmulatorUrl: env.VITE_ECOLOOP_AUTH_EMULATOR_URL || "http://127.0.0.1:9099",
    firestoreEmulatorHost: env.VITE_ECOLOOP_FIRESTORE_EMULATOR_HOST || "127.0.0.1",
    firestoreEmulatorPort: firestorePortStr ? parseInt(firestorePortStr, 10) : 8080,
    functionsEmulatorHost: env.VITE_ECOLOOP_FUNCTIONS_EMULATOR_HOST || "127.0.0.1",
    functionsEmulatorPort: functionsPortStr ? parseInt(functionsPortStr, 10) : 5001,
  };

  // Fail-fast validation in live production mode
  if (mode === "firebase") {
    if (!config.apiKey && import.meta.env.PROD) {
      throw new Error(
        "[EcoLoop Admin] Production build requires VITE_ECOLOOP_FIREBASE_API_KEY. Live configuration is incomplete."
      );
    }
  }

  return config;
}

export const firebaseConfig = loadFirebaseConfig();
