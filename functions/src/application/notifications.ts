import type { Instant } from "../domain/types.js";
import type { MessagingProvider } from "../infrastructure/messaging.js";
import type { ClaimedNotification, NotificationsStore } from "../infrastructure/firestore/notifications_store.js";

export interface NotificationDispatcher {
  dispatchPending(now: Instant, limit?: number): Promise<number>;
}

export class DurableNotificationDispatcher implements NotificationDispatcher {
  constructor(
    private readonly store: NotificationsStore,
    private readonly messaging: MessagingProvider,
  ) {}

  async dispatchPending(now: Instant, limit = 20): Promise<number> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new RangeError("Notification dispatch limit must be between 1 and 100");
    }
    let processed = 0;
    while (processed < limit) {
      const claimed = await this.store.claimNext(now);
      if (claimed === null) break;
      processed += 1;
      const message = buildMessage(claimed);
      if (message === null) {
        await this.store.skip(claimed.intent.id, claimed.attempt, now);
        continue;
      }
      if (claimed.devices.length === 0) {
        await this.store.complete(claimed.intent.id, claimed.attempt, { accepted: false, errorCode: "no eligible recipient" }, now);
        continue;
      }
      let accepted = false;
      let lastFailure: { readonly accepted: boolean; readonly errorCode?: string } = {
        accepted: false,
        errorCode: "provider_error",
      };
      for (const device of claimed.devices) {
        const result = await this.messaging.send({ ...message, token: device.token });
        if (result.accepted) {
          accepted = true;
          await this.store.complete(claimed.intent.id, claimed.attempt, result, now);
          break;
        }
        lastFailure = result;
        if (result.invalidToken) await this.store.disableDevice(claimed.intent.recipientUid, device.deviceId, now);
      }
      if (!accepted) await this.store.complete(claimed.intent.id, claimed.attempt, lastFailure, now);
    }
    return processed;
  }
}

function buildMessage(claimed: ClaimedNotification): Omit<Parameters<MessagingProvider["send"]>[0], "token"> | null {
  const { intent, preferences } = claimed;
  const hasResult = preferences.recyclingUpdates;
  const hasCredit = preferences.pointsCredits && intent.pointsAwarded !== null && intent.pointsAwarded > 0;
  if (!hasResult && !hasCredit) return null;
  const body = hasResult && hasCredit
    ? `Your recycling result is ${intent.outcome}; ${intent.pointsAwarded} points were credited.`
    : hasCredit
      ? `${intent.pointsAwarded} points were credited for your recycling.`
      : `Your recycling result is ${intent.outcome}.`;
  return {
    notification: { title: "EcoLoop update", body },
    data: {
      eventId: intent.id,
      targetType: "deposit",
      targetId: intent.batchId,
      decisionVersion: String(intent.decisionVersion),
    },
  };
}
