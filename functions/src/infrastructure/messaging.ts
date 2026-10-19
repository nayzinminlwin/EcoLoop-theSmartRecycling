import { getMessaging, type Messaging } from "firebase-admin/messaging";
import type { App } from "firebase-admin/app";

export interface NotificationMessage {
  readonly token: string;
  readonly notification: { readonly title: string; readonly body: string };
  readonly data: Record<string, string>;
}

export interface ProviderSendResult {
  readonly accepted: boolean;
  readonly messageId?: string;
  readonly invalidToken: boolean;
  readonly errorCode?: string;
}

export interface MessagingProvider {
  send(message: NotificationMessage): Promise<ProviderSendResult>;
}

export class FirebaseMessagingProvider implements MessagingProvider {
  constructor(app: App) {
    this.messaging = getMessaging(app);
  }

  private readonly messaging: Messaging;

  async send(message: NotificationMessage): Promise<ProviderSendResult> {
    try {
      const response = await this.messaging.send(message);
      return { accepted: true, invalidToken: false, messageId: response };
    } catch (error) {
      const errorCode = error instanceof Error && "code" in error
        ? String((error as Error & { code?: unknown }).code)
        : "provider_error";
      return {
        accepted: false,
        invalidToken: errorCode === "messaging/registration-token-not-registered" ||
          errorCode === "messaging/invalid-registration-token",
        errorCode,
      };
    }
  }
}
