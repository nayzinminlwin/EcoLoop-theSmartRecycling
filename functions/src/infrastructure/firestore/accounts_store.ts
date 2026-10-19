import type { Auth, UserRecord } from "firebase-admin/auth";
import type { Firestore, Transaction, Timestamp } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import type { Instant } from "../../domain/types.js";
import { timestampToInstant } from "./codecs.js";

export interface AccountInput {
  readonly uid: string;
  readonly displayName: string;
  readonly email: string;
  readonly avatarUrl: string | null;
  readonly claims: Record<string, unknown>;
  readonly now: Instant;
}

export interface AccountResult {
  readonly profile: Record<string, unknown>;
  readonly wallet: Record<string, unknown>;
  readonly preferences: Record<string, unknown>;
  readonly stats: Record<string, unknown>;
  readonly role: string;
  readonly created: boolean;
}

export interface AccountsStore {
  bootstrap(input: AccountInput): Promise<AccountResult>;
  getProfile(uid: string): Promise<Record<string, unknown> | null>;
  savePreferences(uid: string, preferences: Record<string, boolean>, now: Instant): Promise<Record<string, unknown>>;
  registerDevice(uid: string, deviceId: string, platform: string, token: string, now: Instant): Promise<Record<string, unknown>>;
  unregisterDevice(uid: string, deviceId: string, now: Instant): Promise<void>;
}

export class FirestoreAccountsStore implements AccountsStore {
  constructor(private readonly firestore: Firestore, private readonly auth: Auth) {}

  async bootstrap(input: AccountInput): Promise<AccountResult> {
    const authenticatedUser = await this.auth.getUser(input.uid);
    const trustedClaims = authenticatedUser.customClaims ?? {};
    const role = resolveRole(trustedClaims);
    const profileRef = this.firestore.doc(`residents/${input.uid}`);
    const walletRef = profileRef.collection("wallet").doc("current");
    const preferencesRef = profileRef.collection("preferences").doc("current");
    const statsRef = profileRef.collection("stats").doc("current");

    const result = await this.firestore.runTransaction(async (transaction) => {
      const [profileSnap, walletSnap, preferencesSnap, statsSnap] = await Promise.all([
        transaction.get(profileRef),
        transaction.get(walletRef),
        transaction.get(preferencesRef),
        transaction.get(statsRef),
      ]);
      const profile = profileSnap.exists ? profileSnap.data()! : this.newProfile(input, role);
      const wallet = walletSnap.exists ? walletSnap.data()! : this.newWallet(input);
      const preferences = preferencesSnap.exists ? preferencesSnap.data()! : this.newPreferences(input);
      const stats = statsSnap.exists ? statsSnap.data()! : this.newStats(input);
      if (!profileSnap.exists) transaction.create(profileRef, profile);
      if (!walletSnap.exists) transaction.create(walletRef, wallet);
      if (!preferencesSnap.exists) transaction.create(preferencesRef, preferences);
      if (!statsSnap.exists) transaction.create(statsRef, stats);
      return { profile, wallet, preferences, stats, created: !profileSnap.exists };
    });

    await this.ensureRoleClaim(input.uid, trustedClaims, role);
    return { ...result, role };
  }

  async getProfile(uid: string): Promise<Record<string, unknown> | null> {
    const snapshot = await this.firestore.doc(`residents/${uid}`).get();
    return snapshot.exists ? snapshot.data() ?? null : null;
  }

  async savePreferences(uid: string, preferences: Record<string, boolean>, now: Instant): Promise<Record<string, unknown>> {
    const ref = this.firestore.doc(`residents/${uid}/preferences/current`);
    await ref.set({ ...preferences, updatedAt: now, updatedAtServer: FieldValue.serverTimestamp() }, { merge: true });
    return (await ref.get()).data() ?? {};
  }

  async registerDevice(uid: string, deviceId: string, platform: string, token: string, now: Instant): Promise<Record<string, unknown>> {
    const ref = this.firestore.doc(`residents/${uid}/devices/${deviceId}`);
    const data = { deviceId, platform, token, enabled: true, updatedAt: now, updatedAtServer: FieldValue.serverTimestamp() };
    await ref.set(data, { merge: true });
    return (await ref.get()).data() ?? data;
  }

  async unregisterDevice(uid: string, deviceId: string, now: Instant): Promise<void> {
    await this.firestore.doc(`residents/${uid}/devices/${deviceId}`).set({
      enabled: false,
      updatedAt: now,
      disabledAt: now,
    }, { merge: true });
  }

  private newProfile(input: AccountInput, role: string): Record<string, unknown> {
    return {
      residentId: input.uid,
      displayName: input.displayName,
      email: input.email,
      avatarUrl: input.avatarUrl,
      role,
      createdAt: input.now,
      updatedAt: input.now,
    };
  }

  private newWallet(input: AccountInput): Record<string, unknown> {
    return { residentId: input.uid, balance: 0, version: 0, updatedAt: input.now };
  }

  private newPreferences(input: AccountInput): Record<string, unknown> {
    return { residentId: input.uid, recyclingUpdates: true, pointsCredits: true, rewardReminders: true, updatedAt: input.now };
  }

  private newStats(input: AccountInput): Record<string, unknown> {
    return { residentId: input.uid, verifiedBatchCount: 0, acceptedItemCount: 0, estimatedWeightKg: 0, updatedAt: input.now };
  }

  private async ensureRoleClaim(uid: string, claims: Record<string, unknown>, role: string): Promise<void> {
    const user: UserRecord = await this.auth.getUser(uid);
    const existingClaims = user.customClaims ?? {};
    if (JSON.stringify(existingClaims) !== JSON.stringify(claims)) {
      await this.auth.setCustomUserClaims(uid, { ...existingClaims, ...claims, role });
    }
  }
}

function resolveRole(claims: Record<string, unknown>): string {
  if (claims.admin === true) return "admin";
  if (typeof claims.role === "string" && claims.role.length > 0) return claims.role;
  return "user";
}
