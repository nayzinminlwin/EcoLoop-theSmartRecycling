// =============================================================================
// appCheck.ts — Firebase App Check initialization
// Phase AB-02 — reCAPTCHA Enterprise provider and explicit emulator handling
// =============================================================================

import { initializeAppCheck, ReCaptchaEnterpriseProvider, type AppCheck } from "firebase/app-check";
import type { FirebaseApp } from "firebase/app";
import { firebaseConfig } from "./config.ts";

let appCheckInstance: AppCheck | null = null;

export function initAppCheck(app: FirebaseApp): AppCheck | null {
  if (appCheckInstance) return appCheckInstance;

  if (firebaseConfig.mode === "mock") {
    return null;
  }

  if (firebaseConfig.mode === "emulator") {
    // In emulator mode, allow debug token
    // @ts-expect-error FIREBASE_APPCHECK_DEBUG_TOKEN is browser global
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    try {
      appCheckInstance = initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider("6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI"),
        isTokenAutoRefreshEnabled: true,
      });
    } catch {
      // Ignored if already initialized
    }
    return appCheckInstance;
  }

  if (firebaseConfig.mode === "firebase") {
    if (!firebaseConfig.appCheckSiteKey) {
      console.warn("[EcoLoop Admin] VITE_ECOLOOP_APP_CHECK_SITE_KEY not set. App Check not activated.");
      return null;
    }
    try {
      appCheckInstance = initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(firebaseConfig.appCheckSiteKey),
        isTokenAutoRefreshEnabled: true,
      });
    } catch (err) {
      console.error("[EcoLoop Admin] Failed to initialize App Check:", err);
    }
  }

  return appCheckInstance;
}
