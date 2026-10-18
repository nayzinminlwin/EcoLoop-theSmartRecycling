# P05-P06 — Resident Features, Notifications and Operations

Use the [protocol](EXECUTION_PROTOCOL.md), [architecture](ARCHITECTURE_AND_CONTRACTS.md), [diagnostic catalog](OBSERVABILITY_AND_DEBUGGING.md) and the relevant repository role files. The full feature scope remains required for the one-week target.

## P05 — Complete resident business features

**Depends on:** P04 contracts and settlement/read projections. **Spec:** §§8-14. **Milestone:** M5.

### BK-P05-A — Wallet/history adapters, pagination and owner rebinding

**Role:** Flutter developer; backend query support by integration executor if a named child unit is needed.

**Targets (N/M):** N `lib/features/wallet/data/firebase_wallet_repository.dart`, `lib/features/activity/data/firebase_activity_repository.dart`; M `lib/features/activity/domain/repositories/activity_repository.dart`, `data/mock_activity_repository.dart`, `presentation/controllers/history_controller.dart`, `lib/app/providers/app_providers.dart`; N `test/features/activity/firebase_activity_repository_test.dart`. Named seven-file read-model integration cluster.

1. Bind current-UID wallet and activity streams, including live decision changes from the same batch ID.
2. Add a simple feature-specific page/cursor type if needed; cursors contain ordinary timestamp/ID values, not Firestore snapshots in the domain.
3. Owner/status/date filtering and stable time+ID ordering must match indexes. Reset cursors on filter/UID change; merge updates by batch identity/version so new first-page records do not duplicate older pages.
4. Expose processing/review/excluded/empty/verified clearly. Unknown totals remain unknown.
5. Preserve old mock test semantics except documented contract changes; no Firebase SDK appears in the mock adapter.

**Gate:** pagination, tie ordering, pending->verified update, date boundary, empty feed, missing/index error and A->sign-out->B isolation tests pass. Wallet changes follow committed records, not local increment logic.

### BK-P05-B — Home summaries and current-policy guide

**Targets (N/M):** N `lib/features/recycling_guide/data/firebase_recycling_guide_repository.dart`; M `lib/features/activity/domain/models/recycling_summary.dart`, `lib/features/home/presentation/widgets/impact_summary_card.dart`, `lib/app/providers/app_providers.dart`; N `test/features/home/backend_summary_test.dart`, `test/features/recycling_guide/firebase_guide_test.dart`.

1. Read compact `residentStats` counters rather than downloading all deposits on Home.
2. Compose estimated kg from accepted verified counts using existing constants; label the estimate honestly. Pending/empty/excluded items do not increase personal verified impact.
3. Compose guide content with the active policy's explicit five-class list and rates. Cardboard's paper category must not make it eligible.
4. A current guide update does not rewrite historical receipt policy values.
5. Retain established layout/tokens and existing summary DTO convenience where possible.

**Gate:** normal 37/61 batch yields one verified batch and six accepted items; mixed-category estimated impact is derived correctly; guide policy changes and historical receipts stay distinct.

### BK-P05-C — Profile/security/preferences integration

**Targets (M):** `lib/features/account/data/firebase_account_repository.dart`, `domain/models/account_security_info.dart`, `presentation/screens/profile_screen.dart`, `security_screen.dart`, `presentation/controllers/account_providers.dart`; N `test/features/account/provider_aware_settings_test.dart`.

1. Editable app name, Auth-derived email and supported avatar/initials presentation.
2. Adapt the current email/password mock form to actual Google identity/provider information. No fake password save or invented password age.
3. Persist the three preferences through the backend; device permission is separate from those values.
4. Sign-out disposes owner subscriptions/state, best-effort device association and unsubmitted reservation; submitted work continues.
5. Preserve edited name across later Google sign-ins; retry errors keep the last successful UI state with safe trace reference.

**Gate:** provider-aware settings work with actual Auth metadata and controlled tests; profile mutation cannot change UID, role, login identity or wallet fields.

### BK-P05-D — Atomic redemption and demo voucher backend

**Role:** integration executor.

**Targets (N/M):** N `functions/src/application/rewards.ts`, `infrastructure/firestore/rewards_store.ts`, `transport/resident_rewards.ts`, `tests/emulator/rewards.test.ts`, `tests/unit/voucher_policy.test.ts`; M `functions/src/index.ts`.

1. Validate authenticated owner, active/unexpired offer, displayed version/cost, configured resident limit and integer balance.
2. Recover an existing request before rechecking the limit consumed by that request. Same key/different payload conflicts; a different genuine redemption cannot bypass the limit.
3. Read all transactional inputs before writes. Generate a stable voucher/receipt identity for retries; codes must be unique without logging them.
4. Atomically debit wallet, append spending entry, increment resident reward counter, create redemption receipt and issue single-use demo voucher.
5. Snapshot title/merchant/terms and expire 30 days from issuance independently of catalog expiry. No expiry refund.
6. Implement owner/demo/available/time guarded simulated consumption with one immutable usage event and no second debit.

**Gate:** 37->25->12; duplicate lost-response redemption; changed price; insufficient funds; two simultaneous different requests; lifetime one-per-reward limit; duplicate use; used/expired/non-demo/other-owner rejection; catalog edits preserve issued terms.

### BK-P05-E — Flutter reward offer and redemption wiring

**Targets (N/M):** N `lib/features/rewards/data/firebase_rewards_repository.dart`; M `domain/repositories/rewards_repository.dart`, `domain/models/reward.dart`, `data/mock_rewards_repository.dart`, `presentation/widgets/reward_redemption_dialog.dart` under `lib/features/rewards/`; N `test/features/rewards/backend_redemption_test.dart`. Composition binding in `app_providers.dart` is an explicitly listed integration edit if not already factory-bound.

1. Add current offer version/cost to the confirmed request and use the durable command client.
2. Keep button/dialog busy across ambiguous recovery; do not create another request key after a timeout.
3. Map `offer_changed`, limit and insufficient balance to helpful states without optimistic debit.
4. Display the actual committed receipt/voucher. Existing catalog prices become 10/25/50/75 from the seed; new residents receive no fixture wallet grant.
5. Ensure owner-specific redemption counts do not become shared catalog facts.

**Gate:** observable earning-to-spending flow and retry/price-conflict widget tests; actual backend balance/receipt agree.

### BK-P05-F — Voucher use UI and time-correct lists

**Targets (M/N):** M `lib/features/rewards/domain/models/resident_voucher.dart`, `presentation/controllers/vouchers_controller.dart`, `presentation/screens/voucher_detail_screen.dart`, `data/firebase_rewards_repository.dart`; N `test/features/rewards/voucher_lifecycle_test.dart`, `test/features/rewards/voucher_queries_test.dart`.

1. Add/read required demo metadata and versioned backend fields without trusting client-set flags.
2. Keep Copy code independent; show a clearly labeled Simulate voucher use action for an eligible demo voucher and reflect the committed use once.
3. Refresh/watch by ID so the current FutureProvider-only detail does not remain stale after consumption.
4. Available/used/expired filters and pagination must handle time expiry even before cron updates the stored status. Rebind query/timer on foreground resume and relevant expiry boundaries.
5. Use the dynamic clock; used remains used after time passes; an unused expired voucher gives no refund.

**Gate M5:** backend/app agree on issue/use/expiry, repeat actions and status lists. Cached state cannot enable a successful second use.

## P06 — Messaging, recovery and scheduled operation

**Roles:** integration executor + Flutter developer for their named paths. **Spec:** §§5.4, 9, 14-17. **Milestone:** M6.

### BK-P06-A — Durable notification dispatcher

**Targets (N/M):** N `functions/src/application/notifications.ts`, `infrastructure/firestore/notifications_store.ts`, `infrastructure/messaging.ts`, `transport/notification_dispatch.ts`, `tests/emulator/notifications.test.ts`; M `functions/src/index.ts`.

1. Consume intents committed with outcome/credit; deduplicate logical events by source decision version.
2. Re-read current preferences and device association at dispatch. Combine result/credit components when appropriate.
3. Deliver safe summary/target IDs, record provider acceptance/failure and bounded retry. Never mutate money to resend a message.
4. Remove/disable invalid device tokens safely. Handle multiple legitimate devices and account switching without exposing tokens.
5. Keep provider send outcome separate from proof of user receipt/read. Transport duplicates cannot become duplicate accounting.

**Gate:** preference combinations, combined event, failed send retry, stale device association and duplicate event tests pass.

### BK-P06-B — Android/Flutter device lifecycle and foreground messages

**Targets (N/M):** N `lib/features/notifications/data/firebase_notification_service.dart`, `presentation/notification_coordinator.dart`; M `lib/app/bootstrap.dart`, `lib/features/account/data/firebase_account_repository.dart`, `lib/app/providers/app_providers.dart`; N `test/features/notifications/notification_lifecycle_test.dart`.

1. Initialize Messaging in the proper runtime and register token/platform/installation with the current authenticated owner.
2. Respect device permission and preference state; denied permission leaves all business features usable.
3. Handle token refresh, sign-out/account switch, app foreground/background and safe deep-link opening after auth/provisioning.
4. Background callbacks use a top-level entrypoint and initialize only required Firebase facilities; they do not settle deposits.
5. Verify recipient/current UID before opening private target data. Prefer safe generic system-notification text when account association may have changed; detailed points are fetched under auth.
6. Avoid duplicate foreground UI/system messages for the same logical event.

**Gate:** controlled notification tests plus actual Android token/foreground/background delivery evidence when device permission is granted.

### BK-P06-C — Web worker, Hosting and permitted native permissions

**Targets (N/M):** N `web/firebase-messaging-sw.js`; M `web/index.html`, `android/app/src/main/AndroidManifest.xml`, `firebase.json`, `lib/features/notifications/data/firebase_notification_service.dart`; N/M `tools/backend/build_web_config.ps1` if worker public-config generation is required.

1. Supply verified public Firebase web configuration/VAPID and a pinned compatible worker SDK. Provider secrets are never present.
2. Ensure the deployed worker URL returns JavaScript, not the SPA HTML fallback. Register one correct messaging worker/scope and test reload/update behavior.
3. Preserve current Flutter bootstrap behavior; inspect current build tooling instead of assuming obsolete PWA flags.
4. Configure resident Hosting HTTPS/SPA route restoration separately from the friend's admin target.
5. Add only required camera/Internet/notification permissions in the permitted manifest. Do not edit protected Gradle/Google Services files; block/report if a plugin genuinely requires them.
6. Verify real browser camera permission and Google auth domain registration.

**Gate:** actual HTTPS browser QR, auth and push receipt; Android release-capable manifest/client smoke; no duplicate worker registration.

### BK-P06-D — Reconciliation, deadlines and controlled operator tools

**Targets (N/M):** N `functions/src/application/maintenance.ts`, `infrastructure/firestore/maintenance_store.ts`, `transport/schedules.ts`, `functions/tools/operator.ts`, `tests/emulator/recovery.test.ts`; M `functions/src/index.ts`.

1. Reconcile pending dispatch and stale jobs through the existing job/settlement services, not a second accounting implementation.
2. Recover expired attempts with fencing and remaining-budget checks; expired/exhausted jobs finalize review once.
3. Expire abandoned unsubmitted reservations and clear matching references; never delete a newer reservation.
4. Provide an authorized collection tool/harness with expected-cycle checking, explicit environment/project and auditable run identity. Default to emulator; IAM-authorized live operator use is intentional and scoped.
5. Exercise future review resolution in the controlled emulator/domain harness without publishing the separate admin endpoint.
6. Log precise recovery/collection events and include a paused-service scenario. A cold scale-to-zero worker is not automatically a disabled bin.

**Gate:** interrupted dispatch, crash-after-artifacts, lost finalization response, stale callback, timeout versus completion and collection-before-review tests preserve all TX invariants.

### BK-P06-E — Daily reminder/expiry/retention and cost controls

**Targets (M/N):** M `functions/src/application/maintenance.ts`, `transport/schedules.ts`, `infrastructure/firestore/maintenance_store.ts`; N `functions/tests/emulator/maintenance.test.ts`, `functions/tools/inspect.ts`; M `functions/package.json` for readonly inspection command.

1. Use a daily Malaysia-time schedule (record the selected deployment hour). Produce one logical three-days-before-expiry reminder while available/preference-enabled.
2. Expire available vouchers without refunds; authorization/use/list semantics already enforce current time independently of cron.
3. Purge only eligible per-run diagnostic objects after resolution+30 days. Pending reviews have no purge date until resolution. Preserve shared source versions and compact business/decision history.
4. Use exact scoped paths/generations and recheck current eligibility before deletion; never broad-recursively delete a bucket/prefix containing shared sources.
5. Configure measured bounded calls, queue/concurrency/instance limits, runtime availability reasons and billing controls. Pause new scans when overall processing is unavailable; Gemini-only limits route unresolved cases to review.
6. Build the readonly inspect tool from diagnostics D7; no automatic repair/debit/credit capability in inspection mode.

**Gate M6:** injected-clock reminder/expiry/30-day cleanup tests, real scheduled-service configuration, actual push delivery and readonly diagnosis are recorded. A simulated future date in a test is not a changed real voucher rule.
