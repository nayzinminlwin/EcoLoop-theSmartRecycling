import type { Firestore, Timestamp } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import type { Instant } from "../../domain/types.js";
import { timestampToInstant } from "./codecs.js";
import { computeScopedHash, computePayloadFingerprint } from "../../domain/admin_crypto.js";

export { computeScopedHash, computePayloadFingerprint };

export interface AdminReceipt {
  readonly schemaVersion: "admin.v1";
  readonly operation: string;
  readonly requestId: string;
  readonly traceId: string;
  readonly status: "committed";
  readonly data: {
    readonly resourceId: string;
    readonly version: number;
    readonly operationState: "applied" | "replayed";
    readonly committedAt: Instant;
    readonly [key: string]: unknown;
  };
}

export interface StoredAdminOperation {
  readonly scopedHash: string;
  readonly actorUid: string;
  readonly operation: string;
  readonly requestId: string;
  readonly payloadFingerprint: string;
  readonly traceId: string;
  readonly status: "committed";
  readonly data: Record<string, unknown>;
  readonly createdAt: Timestamp;
}

export class FirestoreAdminOperationsStore {
  private readonly firestore: Firestore;

  constructor(firestore: Firestore) {
    this.firestore = firestore;
  }

  async getReceipt(actorUid: string, operation: string, requestId: string): Promise<AdminReceipt | null> {
    const hash = computeScopedHash(actorUid, operation, requestId);
    const snap = await this.firestore.doc(`adminOperations/${hash}`).get();
    if (!snap.exists) return null;
    return this.mapDocToReceipt(snap.data()!);
  }

  async getReceiptByRequestId(actorUid: string, targetRequestId: string): Promise<AdminReceipt | null> {
    const querySnap = await this.firestore
      .collection("adminOperations")
      .where("actorUid", "==", actorUid)
      .where("requestId", "==", targetRequestId)
      .limit(1)
      .get();

    const firstDoc = querySnap.docs[0];
    if (!firstDoc) return null;
    return this.mapDocToReceipt(firstDoc.data());
  }

  async recordReceipt(
    actorUid: string,
    operation: string,
    requestId: string,
    payloadFingerprint: string,
    traceId: string,
    data: { resourceId: string; version: number; [key: string]: unknown }
  ): Promise<AdminReceipt> {
    const hash = computeScopedHash(actorUid, operation, requestId);
    const docRef = this.firestore.doc(`adminOperations/${hash}`);
    const nowInstant = new Date().toISOString();

    const record: StoredAdminOperation = {
      scopedHash: hash,
      actorUid,
      operation,
      requestId,
      payloadFingerprint,
      traceId,
      status: "committed",
      data: {
        ...data,
        operationState: "applied",
        committedAt: nowInstant,
      },
      createdAt: FieldValue.serverTimestamp() as unknown as Timestamp,
    };

    await docRef.set(record);
    return {
      schemaVersion: "admin.v1",
      operation,
      requestId,
      traceId,
      status: "committed",
      data: {
        ...data,
        operationState: "applied",
        committedAt: nowInstant,
      },
    };
  }

  private mapDocToReceipt(data: Record<string, unknown>): AdminReceipt {
    const opData = (data.data ?? {}) as Record<string, unknown>;
    return {
      schemaVersion: "admin.v1",
      operation: String(data.operation ?? ""),
      requestId: String(data.requestId ?? ""),
      traceId: String(data.traceId ?? ""),
      status: "committed",
      data: {
        resourceId: String(opData.resourceId ?? ""),
        version: Number(opData.version ?? 0),
        operationState: "replayed",
        committedAt: String(opData.committedAt ?? timestampToInstant(data.createdAt as Timestamp | undefined) ?? new Date().toISOString()),
        ...opData,
      },
    };
  }
}
