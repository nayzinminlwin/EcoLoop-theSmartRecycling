import { describe, expect, it } from "vitest";
import { DurableNotificationDispatcher } from "../../src/application/notifications.js";
import type {
  ClaimedNotification,
  NotificationsStore,
} from "../../src/infrastructure/firestore/notifications_store.js";
import type { MessagingProvider, NotificationMessage, ProviderSendResult } from "../../src/infrastructure/messaging.js";

const now = "2026-10-19T03:00:00.000Z";

class FakeStore implements NotificationsStore {
  readonly completed: unknown[] = [];
  readonly skipped: string[] = [];
  readonly disabled: string[] = [];
  private claimed = true;

  constructor(private readonly notification: ClaimedNotification) {}

  async claimNext(): Promise<ClaimedNotification | null> {
    if (!this.claimed) return null;
    this.claimed = false;
    return this.notification;
  }

  async complete(eventId: string, attempt: number, result: unknown): Promise<void> {
    this.completed.push({ eventId, attempt, result });
  }

  async disableDevice(uid: string, deviceId: string): Promise<void> {
    this.disabled.push(`${uid}/${deviceId}`);
  }

  async skip(eventId: string): Promise<void> {
    this.skipped.push(eventId);
  }
}

class FakeMessaging implements MessagingProvider {
  readonly messages: NotificationMessage[] = [];

  constructor(private readonly results: ProviderSendResult[]) {}

  async send(message: NotificationMessage): Promise<ProviderSendResult> {
    this.messages.push(message);
    return this.results[this.messages.length - 1] ?? { accepted: true, invalidToken: false };
  }
}

function notification(
  preferences: ClaimedNotification["preferences"],
  devices = [{ deviceId: "device-1", platform: "android", token: "token-1" }],
): ClaimedNotification {
  return {
    intent: {
      id: "event-batch-1-2",
      recipientUid: "resident-1",
      batchId: "batch-1",
      decisionVersion: 2,
      outcome: "verified",
      pointsAwarded: 12,
      createdAt: now,
    },
    preferences,
    devices,
    attempt: 1,
  };
}

describe("durable notification dispatcher", () => {
  it("combines result and positive credit when both preferences are enabled", async () => {
    const store = new FakeStore(notification({ recyclingUpdates: true, pointsCredits: true, rewardReminders: false }));
    const messaging = new FakeMessaging([{ accepted: true, invalidToken: false, messageId: "message-1" }]);

    await new DurableNotificationDispatcher(store, messaging).dispatchPending(now);

    expect(messaging.messages[0]).toMatchObject({
      notification: { body: "Your recycling result is verified; 12 points were credited." },
      data: { targetId: "batch-1", decisionVersion: "2" },
    });
    expect(store.completed[0]).toMatchObject({ result: { accepted: true } });
  });

  it("does not send when the current preferences suppress both components", async () => {
    const store = new FakeStore(notification({ recyclingUpdates: false, pointsCredits: false, rewardReminders: true }));
    const messaging = new FakeMessaging([]);

    await new DurableNotificationDispatcher(store, messaging).dispatchPending(now);

    expect(messaging.messages).toHaveLength(0);
    expect(store.skipped).toEqual(["event-batch-1-2"]);
  });

  it("disables invalid tokens and retries another legitimate device without duplicating the intent", async () => {
    const store = new FakeStore(notification(
      { recyclingUpdates: true, pointsCredits: false, rewardReminders: false },
      [
        { deviceId: "stale-device", platform: "android", token: "stale-token" },
        { deviceId: "current-device", platform: "web", token: "current-token" },
      ],
    ));
    const messaging = new FakeMessaging([
      { accepted: false, invalidToken: true, errorCode: "messaging/registration-token-not-registered" },
      { accepted: true, invalidToken: false, messageId: "message-2" },
    ]);

    await new DurableNotificationDispatcher(store, messaging).dispatchPending(now);

    expect(store.disabled).toEqual(["resident-1/stale-device"]);
    expect(messaging.messages).toHaveLength(2);
    expect(store.completed).toHaveLength(1);
    expect(store.completed[0]).toMatchObject({ result: { accepted: true, messageId: "message-2" } });
  });
});
