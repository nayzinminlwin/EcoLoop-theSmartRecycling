import type { Auth } from "firebase-admin/auth";
import type { Firestore, Timestamp } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import type { Instant } from "../../domain/types.js";
import { timestampToInstant } from "./codecs.js";

export interface AdminAccountRecord {
  readonly uid: string;
  readonly email: string;
  readonly displayName: string | null;
  readonly enabled: boolean;
  readonly role: "admin";
  readonly updatedAt: Instant;
}

export interface AdminVerificationResult {
  readonly uid: string;
  readonly email: string;
  readonly displayName: string | null;
  readonly enabled: boolean;
  readonly role: "admin";
}

export class FirestoreAdminAccountsStore {
  private readonly firestore: Firestore;
  private readonly auth: Auth;

  constructor(firestore: Firestore, auth: Auth) {
    this.firestore = firestore;
    this.auth = auth;
  }

  async getAdminAccount(uid: string): Promise<AdminAccountRecord | null> {
    const docRef = this.firestore.doc(`adminAccounts/${uid}`);
    const snap = await docRef.get();
    if (!snap.exists) return null;
    const data = snap.data()!;
    return {
      uid,
      email: String(data.email ?? ""),
      displayName: data.displayName ? String(data.displayName) : null,
      enabled: Boolean(data.enabled),
      role: "admin",
      updatedAt: timestampToInstant(data.updatedAt as Timestamp | undefined) ?? new Date().toISOString(),
    };
  }

  async verifyCaller(caller: { uid: string; token: Record<string, unknown> }): Promise<AdminVerificationResult> {
    const roleClaim = caller.token.role ?? (caller.token.admin === true ? "admin" : undefined);
    if (roleClaim !== "admin") {
      const err = new Error("Caller lacks required administrator role.");
      (err as unknown as { code: string }).code = "permission-denied";
      throw err;
    }

    const docRef = this.firestore.doc(`adminAccounts/${caller.uid}`);
    const snap = await docRef.get();
    if (!snap.exists) {
      const err = new Error("Administrator account is not provisioned.");
      (err as unknown as { code: string }).code = "permission-denied";
      throw err;
    }

    const data = snap.data()!;
    if (data.enabled !== true) {
      const err = new Error("Administrator account has been disabled.");
      (err as unknown as { code: string }).code = "permission-denied";
      throw err;
    }

    return {
      uid: caller.uid,
      email: String(data.email ?? caller.token.email ?? ""),
      displayName: data.displayName ? String(data.displayName) : null,
      enabled: true,
      role: "admin",
    };
  }

  async provisionAdmin(input: {
    uid: string;
    email: string;
    displayName: string | null;
    enabled: boolean;
  }): Promise<AdminAccountRecord> {
    const user = await this.auth.getUser(input.uid);
    const existingClaims = user.customClaims ?? {};
    await this.auth.setCustomUserClaims(input.uid, {
      ...existingClaims,
      role: "admin",
    });

    const docRef = this.firestore.doc(`adminAccounts/${input.uid}`);
    const record = {
      uid: input.uid,
      email: input.email,
      displayName: input.displayName,
      enabled: input.enabled,
      role: "admin",
      updatedAt: FieldValue.serverTimestamp(),
    };
    await docRef.set(record, { merge: true });

    return {
      uid: input.uid,
      email: input.email,
      displayName: input.displayName,
      enabled: input.enabled,
      role: "admin",
      updatedAt: new Date().toISOString(),
    };
  }
}
