# Rewards Redemption Troubleshooting & Root Cause Analysis

## Executive Summary

On 2026-10-26, resident reward redemptions consistently failed with the error:

```text
This offer changed. Refresh the rewards list and try again.
```

Refreshing the rewards list did not resolve the issue.

### Root Cause
The rejection was caused by a **Google Cloud deployment regression**:
1. On 2026-10-21 (commit `520c4c5`), the reward redemption logic was updated to use `instantMillis(reward.catalogExpiresAt ?? reward.expiresAt)` to properly parse Firestore `Timestamp` objects into epoch milliseconds.
2. On 2026-10-22 at 08:59:31 UTC, an admin backend deployment from branch `dev1` ran `firebase deploy --only functions`, deploying all Cloud Functions from that branch.
3. Because `dev1` had branched off prior to commit `520c4c5`, the deployment rolled back the live `redeemReward` Cloud Function in Cloud Run to revision `redeemreward-00011-tiq`.
4. Revision `redeemreward-00011-tiq` contained the unpatched line:
   ```javascript
   const expiresAt = Date.parse(String(reward.catalogExpiresAt ?? reward.expiresAt ?? ""));
   ```
5. In Node.js, `String(Timestamp)` evaluates to `"[object Object]"`, causing `Date.parse(...)` to return `NaN`.
6. Because `!Number.isFinite(NaN)` evaluates to `true`, the function unconditionally threw `DomainError("offer_changed", "The reward offer has changed or expired")`.
7. This was mapped by `mapRewardError` to `HttpsError("failed-precondition")`, which the Flutter client translated as `"This offer changed. Refresh the rewards list and try again."`.

## Resolution

### 1. Cloud Function Redeployment
The functions `redeemReward` and `redeemResidentReward` were compiled from the current `dev` codebase (containing `instantMillis`) and redeployed via Firebase CLI:

```powershell
cd functions
npm run build
firebase deploy --only functions:redeemReward,functions:redeemResidentReward
```

- Verified active Cloud Run revision: `redeemreward-00012-zan` (`CONDITION_SUCCEEDED`).

### 2. Client-Side Overhead Cleanup
- Reverted the redundant blocking `Source.server` Firestore read before each redemption call in `lib/features/rewards/data/firebase_rewards_repository.dart`.
- Restored optimistic parameter passing (`offerVersion` and `pointsCost` from the displayed `Reward` model) in `lib/features/rewards/presentation/screens/rewards_screen.dart`.
- Retained defensive non-recovery of business-level rejections in `lib/core/firebase/command_client.dart` (`_shouldRecover`).

## Validation

- **Functions Unit Tests**: All 115 tests passed (`npm run test:unit`).
- **Cloud Run Deployment**: `redeemreward-00012-zan` deployed and serving 100% traffic.
- **Flutter Analyzer**: `flutter analyze` completed with no issues.
- **Flutter Test Suite**: All 26 rewards and command client tests passed (`flutter test test/features/rewards/ test/core/firebase/command_client_test.dart`).
