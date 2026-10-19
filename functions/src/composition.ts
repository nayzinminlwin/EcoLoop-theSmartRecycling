import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { FirestoreAccountsStore } from "./infrastructure/firestore/accounts_store.js";
import { FirestoreSessionsStore } from "./infrastructure/firestore/sessions_store.js";
import { StructuredLogger } from "./infrastructure/logger.js";
import { FirestoreInspectionStore } from "./infrastructure/firestore/inspection_store.js";
import { FirestoreJobsStore } from "./infrastructure/firestore/jobs_store.js";

let composition: ReturnType<typeof createComposition> | undefined;

export function createComposition() {
  const app = getApps()[0] ?? initializeApp();
  const firestore = getFirestore(app, process.env.ECOLOOP_FIRESTORE_DATABASE ?? "ecoloop-db");
  const auth = getAuth(app);
  const logger = new StructuredLogger(process.env.NODE_ENV ?? "production");
  return {
    app,
    firestore,
    auth,
    accounts: new FirestoreAccountsStore(firestore, auth),
    sessions: new FirestoreSessionsStore(firestore, logger),
    inspections: new FirestoreInspectionStore(firestore),
    jobs: new FirestoreJobsStore(firestore),
  };
}

export function getComposition() {
  composition ??= createComposition();
  return composition;
}
