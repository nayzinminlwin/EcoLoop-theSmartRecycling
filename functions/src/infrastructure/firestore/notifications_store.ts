import type { DocumentData, Firestore } from "firebase-admin/firestore";
import type { Instant } from "../../domain/types.js";

export type NotificationPreference = "recyclingUpdates" | "pointsCredits" | "rewardReminders";
export type NotificationState = "pending" | "sending" | "retry_wait" | "sent" | "skipped" | "failed";

export interface NotificationIntent {
  readonly id: string;
  readonly recipientUid: string;
  readonly batchId: string;
  readonly decisionVersion: number;
  readonly outcome: string;
  readonly pointsAwarded: number | null;
  readonly createdAt: string;
  readonly kind?: string;
  readonly targetType?: string;
  readonly targetId?: string;
}

export interface NotificationDevice {
  readonly deviceId: string;
  readonly platform: string;
  readonly token: string;
}

export interface ClaimedNotification {
  readonly intent: NotificationIntent;
  readonly preferences: Record<NotificationPreference, boolean>;
  readonly devices: readonly NotificationDevice[];
  readonly attempt: number;
}

export interface NotificationsStore {
  claimNext(now: Instant): Promise<ClaimedNotification | null>;
  complete(
    eventId: string,
    attempt: number,
    result: { readonly accepted: boolean; readonly messageId?: string; readonly errorCode?: string },
    now: Instant,
  ): Promise<void>;
  skip(eventId: string, attempt: number, now: Instant): Promise<void>;
  disableDevice(uid: string, deviceId: string, now: Instant): Promise<void>;
}

const MAX_ATTEMPTS = 3;

export class FirestoreNotificationsStore implements NotificationsStore {
  constructor(private readonly firestore: Firestore) {}

  async claimNext(now: Instant): Promise<ClaimedNotification | null> {
    const candidates = await this.firestore.collection("notificationEvents")
      .where("state", "in", ["pending", "retry_wait"])
      .limit(20)
      .get();
    for (const candidate of candidates.docs) {
      const claimed = await this.claim(candidate.id, now);
      if (claimed !== null) return claimed;
    }
    return null;
  }

  async complete(
    eventId: string,
    attempt: number,
    result: { readonly accepted: boolean; readonly messageId?: string; readonly errorCode?: string },
    now: Instant,
  ): Promise<void> {
    const ref = this.firestore.doc(`notificationEvents/${eventId}`);
    await this.firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      const current = snapshot.data() ?? {};
      if (!snapshot.exists || current.state !== "sending" || Number(current.dispatchAttempt) !== attempt) return;
      if (result.accepted) {
        transaction.update(ref, {
          state: "sent",
          providerAcceptedAt: now,
          ...(result.messageId === undefined ? {} : { providerMessageId: result.messageId }),
          updatedAt: now,
        });
        return;
      }

      if (attempt < MAX_ATTEMPTS) {
        const delaySeconds = 30 * (2 ** (attempt - 1));
        transaction.update(ref, {
          state: "retry_wait",
          nextAttemptAt: new Date(Date.parse(now) + delaySeconds * 1000).toISOString(),
          providerFailure: result.errorCode ?? "provider_error",
          updatedAt: now,
        });
      } else {
        transaction.update(ref, {
          state: "failed",
          providerFailure: result.errorCode ?? "provider_error",
          updatedAt: now,
        });
      }
    });
  }

  async disableDevice(uid: string, deviceId: string, now: Instant): Promise<void> {
    await this.firestore.doc(`residents/${uid}/devices/${deviceId}`).set({
      enabled: false,
      disabledAt: now,
      updatedAt: now,
    }, { merge: true });
  }

  async skip(eventId: string, attempt: number, now: Instant): Promise<void> {
    const ref = this.firestore.doc(`notificationEvents/${eventId}`);
    await this.firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      const current = snapshot.data() ?? {};
      if (!snapshot.exists || current.state !== "sending" || Number(current.dispatchAttempt) !== attempt) return;
      transaction.update(ref, { state: "skipped", skipReason: "preference_disabled", updatedAt: now });
    });
  }

  private async claim(eventId: string, now: Instant): Promise<ClaimedNotification | null> {
    const eventRef = this.firestore.doc(`notificationEvents/${eventId}`);
    return this.firestore.runTransaction(async (transaction) => {
      const eventSnapshot = await transaction.get(eventRef);
      if (!eventSnapshot.exists) return null;
      const data = eventSnapshot.data() ?? {};
      if (!claimable(data, now)) return null;

      const uid = String(data.recipientUid ?? "");
      const preferencesRef = this.firestore.doc(`residents/${uid}/preferences/current`);
      const devicesRef = this.firestore.collection(`residents/${uid}/devices`);
      const [preferencesSnapshot, devicesSnapshot] = await Promise.all([
        transaction.get(preferencesRef),
        transaction.get(devicesRef),
      ]);
      const preferences = {
        recyclingUpdates: preferencesSnapshot.data()?.recyclingUpdates === true,
        pointsCredits: preferencesSnapshot.data()?.pointsCredits === true,
        rewardReminders: preferencesSnapshot.data()?.rewardReminders === true,
      };
      const devices = await this.currentDevices(uid, devicesSnapshot.docs.map((doc) => ({
        deviceId: String(doc.data().deviceId ?? doc.id),
        platform: String(doc.data().platform ?? "unknown"),
        token: String(doc.data().token ?? ""),
        enabled: doc.data().enabled === true,
        refPath: doc.ref.path,
      })));
      const attempt = Number(data.dispatchAttempt ?? 0) + 1;
      transaction.update(eventRef, {
        state: "sending",
        dispatchAttempt: attempt,
        lastAttemptAt: now,
        updatedAt: now,
      });
      return {
        intent: {
          id: eventSnapshot.id,
          recipientUid: uid,
          batchId: String(data.batchId ?? ""),
          decisionVersion: Number(data.decisionVersion ?? 0),
          outcome: String(data.outcome ?? ""),
          pointsAwarded: data.pointsAwarded === null ? null : Number(data.pointsAwarded ?? 0),
          createdAt: String(data.createdAt ?? now),
          kind: String(data.kind ?? ""),
          targetType: String(data.targetType ?? "deposit"),
          targetId: String(data.targetId ?? data.batchId ?? ""),
        },
        preferences,
        devices,
        attempt,
      };
    });
  }

  private async currentDevices(
    uid: string,
    devices: readonly { deviceId: string; platform: string; token: string; enabled: boolean; refPath: string }[],
  ): Promise<NotificationDevice[]> {
    const associated = await this.firestore.collectionGroup("devices").get();
    const currentOwnerByDevice = new Map<string, string>();
    for (const document of associated.docs) {
      const owner = document.ref.parent.parent?.id;
      if (owner !== undefined && document.data().enabled === true) {
        currentOwnerByDevice.set(String(document.data().deviceId ?? document.id), owner);
      }
    }
    return devices
      .filter((device) => device.enabled && device.token !== "" && currentOwnerByDevice.get(device.deviceId) === uid)
      .map(({ deviceId, platform, token }) => ({ deviceId, platform, token }));
  }
}

function claimable(data: DocumentData, now: Instant): boolean {
  if (data.state !== "pending" && data.state !== "retry_wait") return false;
  return data.nextAttemptAt === undefined || Date.parse(String(data.nextAttemptAt)) <= Date.parse(now);
}
