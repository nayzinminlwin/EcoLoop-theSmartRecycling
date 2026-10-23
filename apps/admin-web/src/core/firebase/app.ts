// =============================================================================
// app.ts — Firebase SDK client initialization with emulator support
// Phase AB-02 — Singleton app, auth, firestore (named DB), and functions
// =============================================================================

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, connectAuthEmulator, type Auth } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator, type Firestore } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator, type Functions } from "firebase/functions";
import { firebaseConfig, type FirebaseClientConfig } from "./config.ts";

export interface FirebaseServices {
  readonly app: FirebaseApp;
  readonly auth: Auth;
  readonly firestore: Firestore;
  readonly functions: Functions;
}

let servicesInstance: FirebaseServices | null = null;

export function getFirebaseServices(config: FirebaseClientConfig = firebaseConfig): FirebaseServices {
  if (servicesInstance) return servicesInstance;

  const app = getApps().length === 0
    ? initializeApp({
        apiKey: config.apiKey || "demo-api-key",
        authDomain: config.authDomain,
        projectId: config.projectId,
        storageBucket: config.storageBucket,
        messagingSenderId: config.messagingSenderId,
        appId: config.appId || "demo-app-id",
      })
    : getApp();

  const auth = getAuth(app);
  const firestore = getFirestore(app, config.database);
  const functions = getFunctions(app, config.region);

  if (config.mode === "emulator") {
    try {
      if (config.authEmulatorUrl) {
        connectAuthEmulator(auth, config.authEmulatorUrl, { disableWarnings: true });
      }
      if (config.firestoreEmulatorHost && config.firestoreEmulatorPort) {
        connectFirestoreEmulator(firestore, config.firestoreEmulatorHost, config.firestoreEmulatorPort);
      }
      if (config.functionsEmulatorHost && config.functionsEmulatorPort) {
        connectFunctionsEmulator(functions, config.functionsEmulatorHost, config.functionsEmulatorPort);
      }
      console.log(`[EcoLoop Admin] Connected to Firebase Emulators (DB: ${config.database})`);
    } catch {
      // In HMR or repeated loads, connectEmulator may throw if already connected
    }
  }

  servicesInstance = { app, auth, firestore, functions };
  return servicesInstance;
}
