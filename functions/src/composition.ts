import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { FirestoreAccountsStore } from "./infrastructure/firestore/accounts_store.js";
import { FirestoreSessionsStore } from "./infrastructure/firestore/sessions_store.js";
import { StructuredLogger } from "./infrastructure/logger.js";
import { FirestoreInspectionStore } from "./infrastructure/firestore/inspection_store.js";
import { FirestoreJobsStore } from "./infrastructure/firestore/jobs_store.js";
import { FirestoreSettlementStore } from "./infrastructure/firestore/settlement_store.js";
import { FirestoreRewardsStore } from "./infrastructure/firestore/rewards_store.js";
import { FirestoreNotificationsStore } from "./infrastructure/firestore/notifications_store.js";
import { FirebaseMessagingProvider } from "./infrastructure/messaging.js";
import { DurableNotificationDispatcher } from "./application/notifications.js";
import { FirestoreMaintenanceStore } from "./infrastructure/firestore/maintenance_store.js";

let composition: ReturnType<typeof createComposition> | undefined;

export function createComposition() {
  const app = getApps()[0] ?? initializeApp();
  const firestore = getFirestore(app, process.env.ECOLOOP_FIRESTORE_DATABASE ?? "ecoloop-db");
  const auth = getAuth(app);
  const logger = new StructuredLogger(process.env.NODE_ENV ?? "production");
  const storageBucketName = process.env.ECOLOOP_STORAGE_BUCKET ?? app.options.storageBucket;
  const storageBucket = storageBucketName === undefined ? undefined : getStorage(app).bucket(storageBucketName);
  return {
    app,
    firestore,
    auth,
    accounts: new FirestoreAccountsStore(firestore, auth),
    sessions: new FirestoreSessionsStore(firestore, logger),
    inspections: new FirestoreInspectionStore(firestore),
    jobs: new FirestoreJobsStore(firestore),
    settlements: new FirestoreSettlementStore(firestore),
    rewards: new FirestoreRewardsStore(firestore),
    notifications: new FirestoreNotificationsStore(firestore),
    notificationDispatcher: new DurableNotificationDispatcher(
      new FirestoreNotificationsStore(firestore),
      new FirebaseMessagingProvider(app),
    ),
    maintenance: new FirestoreMaintenanceStore(firestore, storageBucket),
  };
}

export function getComposition() {
  composition ??= createComposition();
  return composition;
}
