// =============================================================================
// admin_read_versions_store.ts — Narrow topic revision listener store
// Phase AB-03 — Lightweight revision bump & watch for cache invalidation
// =============================================================================

import type { Firestore, Timestamp } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import type { Instant } from "../../domain/types.js";
import { tryTimestampToInstant } from "./codecs.js";

export type ReadTopic = "bins" | "rewards" | "alerts" | "reviews" | "settings" | "dashboard";

export interface ReadVersionRecord {
  readonly topic: ReadTopic;
  readonly version: number;
  readonly updatedAt: Instant;
}

export class FirestoreAdminReadVersionsStore {
  private readonly firestore: Firestore;

  constructor(firestore: Firestore) {
    this.firestore = firestore;
  }

  async getVersion(topic: ReadTopic): Promise<ReadVersionRecord> {
    const docRef = this.firestore.doc(`adminReadVersions/${topic}`);
    const snap = await docRef.get();
    if (!snap.exists) {
      return {
        topic,
        version: 1,
        updatedAt: new Date().toISOString(),
      };
    }
    const data = snap.data()!;
    return {
      topic,
      version: Number(data.version ?? 1),
      updatedAt: tryTimestampToInstant(data.updatedAt) ?? new Date().toISOString(),
    };
  }

  async bumpVersion(topic: ReadTopic, actorUid?: string): Promise<ReadVersionRecord> {
    const docRef = this.firestore.doc(`adminReadVersions/${topic}`);
    const nowInstant = new Date().toISOString();

    return await this.firestore.runTransaction(async (transaction) => {
      const snap = await transaction.get(docRef);
      const currentVersion = snap.exists ? Number(snap.data()?.version ?? 0) : 0;
      const nextVersion = currentVersion + 1;

      transaction.set(
        docRef,
        {
          topic,
          version: nextVersion,
          updatedAt: FieldValue.serverTimestamp(),
          lastInvalidatedBy: actorUid ?? "system",
        },
        { merge: true }
      );

      return {
        topic,
        version: nextVersion,
        updatedAt: nowInstant,
      };
    });
  }
}
