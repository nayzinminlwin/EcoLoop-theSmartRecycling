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

function readEnv(key: string, metaVal?: string): string | undefined {
  if (metaVal !== undefined) {
    return metaVal;
  }
  if (typeof process !== "undefined" && process.env && process.env[key]) {
    return process.env[key];
  }
  return undefined;
}

function resolveBackendMode(rawMode?: string): BackendMode {
  if (rawMode === "firebase" || rawMode === "emulator" || rawMode === "mock") {
    return rawMode;
  }
  if (typeof import.meta !== "undefined" && import.meta.env?.PROD) {
    return "firebase";
  }
  return "mock";
}

export function loadFirebaseConfig(): FirebaseClientConfig {
  const mode = resolveBackendMode(
    readEnv("VITE_ECOLOOP_BACKEND_MODE", typeof import.meta.env !== "undefined" ? import.meta.env.VITE_ECOLOOP_BACKEND_MODE : undefined)
  );
  const projectId =
    readEnv("VITE_ECOLOOP_FIREBASE_PROJECT_ID", typeof import.meta.env !== "undefined" ? import.meta.env.VITE_ECOLOOP_FIREBASE_PROJECT_ID : undefined) ||
    "ecoloop-thesmartrecycling";
  const database =
    readEnv("VITE_ECOLOOP_FIRESTORE_DATABASE", typeof import.meta.env !== "undefined" ? import.meta.env.VITE_ECOLOOP_FIRESTORE_DATABASE : undefined) ||
    "ecoloop-db";
  const region =
    readEnv("VITE_ECOLOOP_FIREBASE_REGION", typeof import.meta.env !== "undefined" ? import.meta.env.VITE_ECOLOOP_FIREBASE_REGION : undefined) ||
    "us-central1";

  // Parse emulator ports
  const firestorePortStr = readEnv(
    "VITE_ECOLOOP_FIRESTORE_EMULATOR_PORT",
    typeof import.meta.env !== "undefined" ? import.meta.env.VITE_ECOLOOP_FIRESTORE_EMULATOR_PORT : undefined
  );
  const functionsPortStr = readEnv(
    "VITE_ECOLOOP_FUNCTIONS_EMULATOR_PORT",
    typeof import.meta.env !== "undefined" ? import.meta.env.VITE_ECOLOOP_FUNCTIONS_EMULATOR_PORT : undefined
  );

  const config: FirebaseClientConfig = {
    mode,
    projectId,
    database,
    region,
    apiKey: readEnv(
      "VITE_ECOLOOP_FIREBASE_API_KEY",
      typeof import.meta.env !== "undefined" ? import.meta.env.VITE_ECOLOOP_FIREBASE_API_KEY : undefined
    ),
    authDomain:
      readEnv(
        "VITE_ECOLOOP_FIREBASE_AUTH_DOMAIN",
        typeof import.meta.env !== "undefined" ? import.meta.env.VITE_ECOLOOP_FIREBASE_AUTH_DOMAIN : undefined
      ) || `${projectId}.firebaseapp.com`,
    storageBucket:
      readEnv(
        "VITE_ECOLOOP_FIREBASE_STORAGE_BUCKET",
        typeof import.meta.env !== "undefined" ? import.meta.env.VITE_ECOLOOP_FIREBASE_STORAGE_BUCKET : undefined
      ) || `${projectId}.firebasestorage.app`,
    messagingSenderId: readEnv(
      "VITE_ECOLOOP_FIREBASE_MESSAGING_SENDER_ID",
      typeof import.meta.env !== "undefined" ? import.meta.env.VITE_ECOLOOP_FIREBASE_MESSAGING_SENDER_ID : undefined
    ),
    appId: readEnv(
      "VITE_ECOLOOP_FIREBASE_APP_ID",
      typeof import.meta.env !== "undefined" ? import.meta.env.VITE_ECOLOOP_FIREBASE_APP_ID : undefined
    ),
    appCheckSiteKey: readEnv(
      "VITE_ECOLOOP_APP_CHECK_SITE_KEY",
      typeof import.meta.env !== "undefined" ? import.meta.env.VITE_ECOLOOP_APP_CHECK_SITE_KEY : undefined
    ),
    authEmulatorUrl:
      readEnv(
        "VITE_ECOLOOP_AUTH_EMULATOR_URL",
        typeof import.meta.env !== "undefined" ? import.meta.env.VITE_ECOLOOP_AUTH_EMULATOR_URL : undefined
      ) || "http://127.0.0.1:9099",
    firestoreEmulatorHost:
      readEnv(
        "VITE_ECOLOOP_FIRESTORE_EMULATOR_HOST",
        typeof import.meta.env !== "undefined" ? import.meta.env.VITE_ECOLOOP_FIRESTORE_EMULATOR_HOST : undefined
      ) || "127.0.0.1",
    firestoreEmulatorPort: firestorePortStr ? parseInt(firestorePortStr, 10) : 8080,
    functionsEmulatorHost:
      readEnv(
        "VITE_ECOLOOP_FUNCTIONS_EMULATOR_HOST",
        typeof import.meta.env !== "undefined" ? import.meta.env.VITE_ECOLOOP_FUNCTIONS_EMULATOR_HOST : undefined
      ) || "127.0.0.1",
    functionsEmulatorPort: functionsPortStr ? parseInt(functionsPortStr, 10) : 5001,
  };

  // Fail-fast validation in live production mode
  if (mode === "firebase") {
    if (!config.apiKey && typeof import.meta !== "undefined" && import.meta.env?.PROD) {
      throw new Error(
        "[EcoLoop Admin] Production build requires VITE_ECOLOOP_FIREBASE_API_KEY. Live configuration is incomplete."
      );
    }
  }

  return config;
}

export const firebaseConfig = loadFirebaseConfig();
