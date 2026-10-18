import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { FirestoreAccountsStore } from "./infrastructure/firestore/accounts_store.js";

let composition: ReturnType<typeof createComposition> | undefined;

export function createComposition() {
  const app = getApps()[0] ?? initializeApp();
  const firestore = getFirestore(app);
  const auth = getAuth(app);
  return { app, firestore, auth, accounts: new FirestoreAccountsStore(firestore, auth) };
}

export function getComposition() {
  composition ??= createComposition();
  return composition;
}
