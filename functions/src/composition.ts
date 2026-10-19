import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { FirestoreAccountsStore } from "./infrastructure/firestore/accounts_store.js";
import { FirestoreSessionsStore } from "./infrastructure/firestore/sessions_store.js";
import { StructuredLogger } from "./infrastructure/logger.js";

let composition: ReturnType<typeof createComposition> | undefined;

export function createComposition() {
  const app = getApps()[0] ?? initializeApp();
  const firestore = getFirestore(app);
  const auth = getAuth(app);
  const logger = new StructuredLogger(process.env.NODE_ENV ?? "production");
  return {
    app,
    firestore,
    auth,
    accounts: new FirestoreAccountsStore(firestore, auth),
    sessions: new FirestoreSessionsStore(firestore, logger),
  };
}

export function getComposition() {
  composition ??= createComposition();
  return composition;
}
