# EcoLoop AI: Figma Make resident app to UI-first Flutter

- **Status:** Execution plan; no application implementation is included in this document.
- **Prepared against:** Repository and Figma Make source inspected on 15 October 2026.
- **Flutter package:** `eco_loop`, in the repository root.
- **Audience:** A coding agent executing the phases sequentially.
- **Backend alignment revision:** Both UI plans target one shared Firebase project in Goals 3–4; Goals 1–2 remain strictly mock-only.

## 1. Goal, boundaries, and execution rules

The overall product roadmap has four goals:

1. Convert the Figma **resident/user app** into a working Flutter UI with realistic mock services. **This document covers this goal.**
2. Convert the Figma admin design into an independently deployed admin website.
3. Implement the shared Firebase backend: Cloud Firestore, Firebase Auth, Cloud Storage, and App Check configuration.
4. Integrate both clients with that same Firebase project and deploy the standalone admin site through Firebase Hosting.

The resident Flutter application must not contain the prototype's admin role switch, “Open admin demo” button, admin pages, or administrative mutations. The future admin website is a separate application that will operate on the same eventual database. `docs/ADMIN_PANEL_PAGES_AND_FILES.md` is contextual background; the actual artifacts are the source of truth for this conversion.

### Required Firebase architecture and mock-only boundary

| Service in Goals 3–4 | Shared architectural contract | Goal 1 / Goal 2 restriction |
|---|---|---|
| **Cloud Firestore** | One NoSQL collection/document store for both clients; string document IDs and flat persisted records, with joins expressed through string IDs | Use stateful in-memory repositories only; no Firestore SDK calls, remote listeners, emulator connections, rules deployment, or collection creation |
| **Firebase Auth** | Firebase Auth UID is the resident/admin identity; custom claim `role` is exactly `user` or `admin` | Mock UID/role/auth-state emissions only; no Firebase sign-in or token calls |
| **Firebase Cloud Storage** | File/image uploads eventually return HTTPS download URL strings; persist URLs, not file objects or blobs | Nullable/mock URL fields and local placeholders only; no real upload/download SDK calls |
| **Firebase App Check** | Both integrated clients will use App Check for applicable Firebase resources | No SDK initialization, provider registration, real/debug token requests, or attestation calls in UI goals |
| **Firebase Hosting** | Standalone `apps/admin-web/dist` deployment with SPA fallback to `/index.html` in Goal 4 | Local web preview/build only; no `firebase init`, `firebase deploy`, Hosting configuration generation, or project selection |

**CRITICAL — Goals 1 and 2 MUST STILL use stateful in-memory `MockRepository` implementations and simulated async delays. DO NOT initialize or call live Firebase SDKs.** Do not add `Firebase.initializeApp`, `FirebaseAuth.instance`, `FirebaseFirestore.instance`, `FirebaseStorage.instance`, `FirebaseAppCheck.instance`, JS `initializeApp`, or equivalent startup side effects. Preserve any existing Firebase dependencies/configuration without activating them; do not run `flutterfire configure` or replace existing generated Firebase options. Firebase implementation and SDK adapters belong to Goals 3–4, not this UI conversion.

The following Android files are existing user-owned Firebase configuration and are protected in **every phase**, with an explicit Phase 1 gate below: `android/build.gradle.kts`, `android/app/build.gradle.kts`, `android/app/google-services.json`. Never reset them to a Flutter/Vite tutorial baseline or edit them to make a UI dependency build.

The Firebase project ID, web app config and Storage bucket are not specified by this plan. Do not invent them or create/select another Firebase project; authorized Goal 3–4 integration must reuse the user's existing project while preserving its native configuration.

### Definition of UI-first completion

- All resident screens, scan stages, settings details, and reachable actions work without a database, API server, camera, smart bin, or AI service.
- Views receive typed data through providers/controllers and abstract repositories. Every simulated service call is asynchronous and passes through `Future.delayed`.
- User data, balances, transactions, material lists, instructions, reward catalogs, vouchers, bin information, and configurable rule values live in mock fixtures/repositories, never inside widget trees.
- Buttons, forms, filters, tabs/chips, toggles, confirmations, retries, and loading/error/empty/success states work locally.
- A single `go_router` configuration owns page paths and parameters. The bottom navigation has the source design's three destinations: **Home, Scan, Settings**.
- Shared state is coherent: a verified deposit updates wallet/history/home once; a redemption updates wallet/catalog/vouchers once; profile changes update every profile surface.
- Models and repository contracts use the shared Firestore-ready document shapes below; composed screen responses are explicitly separated from stored documents. Goals 3–4 supply Firebase adapters, rules/indexes and trusted atomic operations behind these seams.

### How to execute each phase

1. Read the listed source symbols and prerequisite phases. Inspect current changes before editing; this repository already contains untracked artifact/docs content.
2. Create only that phase's files and modify only the explicitly listed existing files plus necessary dependency lock updates.
3. Keep the project compiling at the end of the phase. Register completed routes incrementally; never import a future phase's nonexistent screen.
4. Use widget-test hosts with repository/provider overrides to exercise an individual feature before all destinations exist. Full navigation coverage is the Phase 9 gate.
5. Complete the phase's checklist and the common verification gate before advancing. Record any intentional visual deviation in the handoff document introduced in Phase 1.
6. Do not silently treat a placeholder control in the React prototype as completed functionality. Implement the bounded local behavior specified below.
7. Commit the completed phase before starting the next phase. When one request
   spans multiple phases, preserve separate phase commits where file
   boundaries allow and place only inseparable cross-phase integration in a
   final commit. Commit every request and code edit unless the moderator
   explicitly says not to commit or manually stops the process.

All paths below are **repository-root-relative**. Source line ranges are discovery aids; resolve by symbol if lines move. “Create” means create when absent and reconcile with existing work when present. Model field notation uses `?` for nullable fields and `List<T>` for immutable collections; it is a contract description, not implementation code.

## 2. Findings from the actual source

### Existing Flutter baseline

- `lib/main.dart` is a starter counter application with increment/decrement buttons; it is not an existing EcoLoop feature implementation.
- `test/widget_test.dart` still tests that counter and must be replaced when the app bootstrap changes.
- `pubspec.yaml` names the package `eco_loop`, declares Dart `^3.13.0`, and currently has only Flutter and `cupertino_icons` as runtime dependencies.
- Installed tooling at inspection: Flutter **3.47.0**, Dart **3.13.0**. Confirm this again when executing; select dependency releases compatible with the installed SDK and commit the resulting lockfile only if a commit is requested.
- `analysis_options.yaml` already includes `flutter_lints`; retain the project's lint conventions.

### Source inventory and resident screen coverage

The design is concentrated in two files, not a pre-existing component hierarchy:

| Source path | Symbols / areas | Conversion responsibility |
|---|---|---|
| `EcoLoop_AI_Figma_Design_Artifacts/src/main.tsx` | React mount and CSS import | Flutter bootstrap equivalence |
| `EcoLoop_AI_Figma_Design_Artifacts/src/App.tsx:3–46` | `IconName`, `paths`, `Icon`, `Button`, `Badge`, `Brand` | Shared iconography, buttons, badges, branding |
| `EcoLoop_AI_Figma_Design_Artifacts/src/App.tsx:48–52` | `transactions` | Typed deposit fixtures; shared by history and home |
| `EcoLoop_AI_Figma_Design_Artifacts/src/App.tsx:54–84` | `ResidentApp` | App shell, wallet/session state, header, bottom navigation |
| `EcoLoop_AI_Figma_Design_Artifacts/src/App.tsx:86–105` | `ResidentHome` | Greeting, wallet/progress, scan CTA, impact stats, quick links, recent deposits |
| `EcoLoop_AI_Figma_Design_Artifacts/src/App.tsx:107–136` | `ScanFlow` | Scanner, bin found, ready, item detected, identifying, final result |
| `EcoLoop_AI_Figma_Design_Artifacts/src/App.tsx:138–148` | `RecycleGuide` | Material grid, preparation guidance, do/avoid lists, five steps, point rates |
| `EcoLoop_AI_Figma_Design_Artifacts/src/App.tsx:150–158` | `Rewards` | Catalog, categories, redemption feedback, voucher preview |
| `EcoLoop_AI_Figma_Design_Artifacts/src/App.tsx:160–162` | `History` | Transactions, date/status controls, review explanation |
| `EcoLoop_AI_Figma_Design_Artifacts/src/App.tsx:164–193` | `ResidentSettings`, `rows`, `details` | Settings landing and profile/security/notifications details |
| `EcoLoop_AI_Figma_Design_Artifacts/src/App.tsx:264–268` | Root `App` | Understand demo coupling only; do not reproduce role switching |
| `EcoLoop_AI_Figma_Design_Artifacts/src/index.css:3–22` | Tokens and shared/resident selectors | Central theme, resident geometry and visual states |
| `EcoLoop_AI_Figma_Design_Artifacts/package.json` | React/Vite dependencies | Confirms there is no external UI kit to port |
| `EcoLoop_AI_Figma_Design_Artifacts/public/favicon.svg` | Generic scaffold favicon | Not an EcoLoop logo or resident illustration asset |

Admin code begins at `adminNav` around `App.tsx:195`; admin layout and refinements are mainly `index.css:23–28`. Read those only when necessary to understand shared prototype behavior. The resident artwork is inline SVG/CSS; no resident photographs, Figma image exports, or bundled Inter font files were found in `public/`.

### Explicit fidelity decisions

Preserve the resident layout, palette, hierarchy, rounded components, icon style, and copy intent. Correct these prototype shortcuts deliberately:

| Source shortcut | Planned behavior |
|---|---|
| `beginScan()` starts at step 1 and skips the visible scanner | Every new scan starts at `/scan`; an explicit simulated QR action finds a bin. |
| `245` points paired with hardcoded “55 points” / `82%` | Compute progress against the next higher reward cost. Initial active costs are 100/200/350/500: 245 points means 105 remaining and 70% toward 350. |
| Home stats are `12` / `1.04 kg`, but only three transactions exist | Seed 12 verified deposits totaling 26 items and 1.04 kg derived from the fixed material conversion table, plus one review record; derive both stats and recent activity from the same dataset. |
| Source avatar is `FR` on Home and `AN` in Settings for the same person | Derive initials consistently from `Faris Rezza`. |
| Only the first reward redeems; other handlers are missing | Every eligible active reward can be redeemed through one consistent confirmation flow. |
| Category badges, history filters, “View all” vouchers, and settings actions are inert | Provide working local filters, voucher routes, editable forms, and preference persistence. |
| Shared booleans represent all redemptions | Use reward IDs, voucher IDs, redemption IDs, and idempotency keys. |
| Header bell opens history without a notifications screen | Preserve that mapping; notifications preferences remain under Settings. Do not invent a notifications inbox. |
| Admin callbacks change bin capacity from the resident app | Mock scan services may update their local bin snapshot; there is no admin UI or cross-app bridge. |

New surfaces needed to complete existing controls are **UI extensions**: redemption confirmation, voucher list/detail, editable profile, password form, notification switches, and a signed-out demo-session screen. Reuse existing styling; these are not claims that extra screens exist in Figma. No production login or registration design exists in the artifact.

## 3. Architectural decisions used by every phase

### Dependencies

Add in Phase 1 and resolve versions against the existing SDK:

| Package | Purpose |
|---|---|
| `flutter_riverpod` | Composition root, repository injection, async reads, mutation controllers, invalidation |
| `go_router` | Central routes, path/query parameters, stateful shell, back behavior |
| `intl` | Date, weight, and point presentation from typed values |
| `flutter_svg` | Preserve the prototype's 24×24, 1.8-stroke outline icons |
| `integration_test` under dev dependencies, Flutter SDK source | One final connected resident journey |

Retain `flutter_test` and `flutter_lints`. `cupertino_icons` may remain if used. Use Flutter forms, dialogs, animation, clipboard, and progress widgets. Use hand-written JSON serialization and Riverpod APIs without generators for this scope; no `build_runner`, ORM, HTTP client, map SDK, camera/QR plugin, or remote font dependency is needed to execute this plan.

Do not add Firebase SDK packages to implement Goal 1. If Firebase packages/configuration already exist, preserve them and keep the mock composition root from importing or initializing their runtime services.

### Feature-first layout and dependency direction

The files enumerated in the phases are the authoritative file manifest. The organizing directories are:

- `lib/app/`: bootstrap, dependency composition, navigation, resident shell.
- `lib/core/theme/`: centralized styling only.
- `lib/core/data/`: failures and shared JSON value parsing.
- `lib/core/domain/`: the small material enum shared across features.
- `lib/core/mock/`: fixture loading, mock clock, latency, scenario control, transaction-safe store.
- `lib/core/presentation/`: copy keys and common display formatting.
- `lib/shared/widgets/`: reusable presentation components without feature repositories.
- `lib/features/account/`: resident profile, security, notification preferences, demo session.
- `lib/features/wallet/`: canonical balance and reward-progress contracts.
- `lib/features/home/`: dashboard composition using account/wallet/activity contracts.
- `lib/features/activity/`: history, activity filters, canonical deposit records and impact summaries.
- `lib/features/recycling_guide/`: learning content and configured material rates.
- `lib/features/scan/`: bin lookup, session state machine, classification results.
- `lib/features/rewards/`: catalog, redemption, owned vouchers.
- `assets/mock/`: JSON fixtures, partitioned by feature.
- `assets/icons/`, `assets/fonts/`: offline visual assets.
- `test/` mirrors meaningful contracts/features; `integration_test/` owns the final journey.

Within a feature, use `domain/models/`, `domain/repositories/`, `data/`, `presentation/controllers/`, `presentation/screens/`, and `presentation/widgets/` as needed. Repository interfaces depend on domain types, not Flutter, JSON assets, Riverpod, or concrete mocks. Presentation depends on interfaces through providers. Only the app composition root chooses mock implementations. Features may share domain contracts; they must not import each other's screen/controller internals.

### Data and serialization rules

1. All domain value/request/response models listed in the phases are immutable, have stable **String** IDs where relevant, and implement `fromJson`/`toJson`; stored documents also implement the SDK-free `fromMap`/`toMap` contract below. Add `copyWith` where updates require it. UI-only controller state and callback types do not need JSON serialization.
2. JSON uses **camelCase** keys matching the field names below, ISO-8601 timestamp strings with an explicit offset/UTC, integer item counts, integer points, and the explicit enum wire values listed below (lower camel case where multiword). Weight is derived from item counts for summaries and presentation; it is not stored in transaction or result records. Serialize nested models and enum values explicitly.
3. Never put formatted values such as `"+20"`, `"0.4 kg"`, `"Today, 10:42 AM"`, or badge colors into domain numeric/date/status fields. Display formatters create those strings and presentation maps statuses to theme tones.
4. Define controlled handling for unknown enum values and malformed IDs/dates; repositories translate invalid fixture/service data into `AppFailure`, not a widget crash. Required IDs/numbers must not silently default to fabricated values.
5. Presentation can contain ordinary structural widgets. Fixed interface labels/validation messages belong in `AppCopy`; user-facing **mock content and data-driven lists** come from repositories. Navigation destinations, enum-to-icon maps, and form field definitions are structural configuration, not fake API lists.
6. Guide paragraphs, preparation tips, rate examples, merchant descriptions, and scan instructions are content data returned by the corresponding repository. Widgets must not build their own local fake arrays.

### Shared Firestore document contract — identical in both plans

**Identity:** `ResidentProfile.id` is the Firebase Auth UID and the `residents/{uid}` document ID; `AdminIdentity.id` is the admin Auth UID and `adminProfiles/{uid}` document ID. Existing fields named `residentId`, `adminId`, and `reviewedByAdminId` contain those same UID strings, not SQL foreign-key integers or independently generated person IDs. Fixture values `RES-000842`, `RES-000843`, and `ADM-001` are explicitly **mock UID strings**; Goal 4 uses the actual Auth UID without deriving it from an email, array index or display label. Reject a document-ID/embedded-ID mismatch. Non-user IDs are opaque strings generated by the mock ID factory now and Firestore document allocation later; no auto-increment integer primary keys.

**Auth state:** Introduce shared `AppRole` (`user`, `admin`) and `AuthState` (`uid: String?`, `role: AppRole?`, `isSignedIn: bool`). Signed out is exactly null/null/false; signed in requires a nonblank UID and a recognized role. Roles come from mocked claims now and trusted Firebase Auth custom claims later; they are never editable profile fields. `DemoSession`/`AdminSession` are mock-only navigation/session DTOs, not Firestore records, Auth token stores or the authority for role-based access.

**Persisted documents versus read models:** Flat documents contain scalars, nullable scalars and scalar arrays. `DepositSession` stores `resultId`, not an embedded result; `RewardRedemption` stores `voucherId`, `walletBalanceAfter` and `walletVersion`, not embedded wallet/voucher objects. `RewardRedemptionReceipt`, `RecyclingGuide`, `AdminSettings`, table join rows, dashboard summaries and resident snapshots are **composed repository responses**, never written wholesale to Firestore. Credential requests, auth state, filters and mock sessions are also not Firestore documents.

| Future collection/document path | Flat record and exact ID rule |
|---|---|
| `residents/{uid}` | `ResidentProfile`; `id == uid`, including nullable `avatarUrl: String?` |
| `wallets/{uid}` | `WalletDocument`: `residentId: String`, `balance: int`, `updatedAt: DateTime`, `version: int`; `residentId == uid`. `WalletSnapshot.nextRewardCost` is a computed read projection, not a stored field. |
| `deposits/{id}` | `DepositTransaction`; `id == document ID`, `residentId == owner Auth UID` |
| `bins/{id}` | `SmartBin`; `id == document ID` |
| `depositSessions/{id}` | `DepositSession`; nullable `resultId: String?` references `depositResults` |
| `depositResults/{id}` | `DepositResult`; `sessionId`/`transactionId` reference documents |
| `rewardCategories/{id}` | `RewardCategory`; `id == document ID` |
| `rewards/{id}` | `RewardDocument`: all `Reward` fields except computed `residentRedemptionCount`; includes nullable `imageUrl: String?` |
| `residentVouchers/{id}` | `ResidentVoucher`; owner `residentId` is an Auth UID |
| `rewardRedemptions/{id}` | Flat `RewardRedemption`; `voucherId` references an issued voucher |
| `guideContent/{id}` | `RecyclingGuideContent`: `id`, `heroTitle`, `heroDescription`, `toDo: List<String>`, `toAvoid: List<String>`, `pointsDisclaimer`; default ID `guide-default` |
| `guideMaterials/{id}` / `guideSteps/{id}` | `RecyclingMaterial` / `RecyclingStep`; read models assemble their lists |
| `materialRates/{materialType}` | `MaterialRate`; document ID is the exact material enum string |
| `scanInstructions/default` | `ScanInstructions` with `id: String` equal to `default` |
| `notificationPreferences/{uid}` / `accountSecurity/{uid}` | `NotificationPreferences` / security **metadata** `AccountSecurityInfo`; `residentId == uid`; never store passwords |
| `adminProfiles/{uid}` | `AdminIdentity`; `id == admin Auth UID` |
| `binOperations/{binId}` | `BinOperations`; `binId == bins document ID` |
| `capacityAlerts/{id}` / `verificationTickets/{id}` | Admin-only flat `CapacityAlert` / `VerificationTicket`; existing string ID fields are references, and `captureImageUrl: String?` is a Storage download URL |
| `programSettings/global` | `ProgramSettingsDocument`: `id: String` equal to `global`, `capacityAlertThreshold: int` (75/80/85), `acceptedMaterials: List<MaterialType>`, `updatedAt: DateTime`; rate records live in `materialRates`, not nested settings writes |

Implement `WalletDocument` in `wallet_snapshot.dart` and `RewardDocument` in `reward.dart`, alongside their read models; fields are exactly the omissions listed above, with identical serialization keys on web. The document-path table is a **contract**, not permission to initialize collections now. Fixture files may wrap arrays in envelopes, but each stored entity inside those arrays must have the flat shape. Mock receipts/assembled read models can be cached separately and must never be passed to document writers.

**Date/map signatures (SDK-free in Goal 1):**

- Each flat stored class `T`: `factory T.fromMap(Map<String, Object?> map)` and `Map<String, Object?> toMap()`; `fromJson`/`toJson` remain the ISO-fixture equivalents. Document ID injection/validation happens in a repository mapper, not widgets.
- In `lib/core/data/json_readers.dart`: `DateTime parseDateValue(Object? value)` accepts an offset/UTC ISO string, a `DateTime`, or an SDK-free `{seconds: int, nanoseconds: int}` map; `String encodeDateValue(DateTime value)` emits UTC ISO with millisecond precision. Normalize the same instant on both clients; required invalid/pending-null dates are failures/loading, not fabricated timestamps.
- In the existing `app_formatters.dart`, render instants against the injected +480-minute demo offset (including Today/range boundaries), not the host machine's timezone. Apply the display offset to a presentation copy only; domain/map values stay UTC instants. This fixed Asia/Kuala_Lumpur demo needs no Firebase or timezone SDK.
- Goals 1–2 `toMap`/JSON use ISO strings. In Goals 3–4, Firebase-specific repository converters translate only declared instant fields to/from real Firestore `Timestamp` values (including server timestamps); no SDK `Timestamp`, `DocumentReference`, snapshot or sentinel reaches a widget/domain constructor. Calendar labels such as `DailyActivity.date` remain `YYYY-MM-DD` strings.
- `avatarUrl`, `imageUrl`, and `captureImageUrl` are nullable **HTTPS download URL strings**. Null uses a local placeholder. Never store `File`, `XFile`, `Blob`, bytes, base64, a StorageReference, `gs://` path or upload task in a model; future Storage adapters return a URL string. Mock UI does not fetch a live Firebase URL or upload a file.

### Async and state rules

- Use one app-scoped instance of each mock repository sharing one `MockDataStore`, one injected `AppClock`, and one `MockApi` helper.
- Every async CRUD/read/auth call, including cached reads and failures, goes through `MockApi` and awaits `Future.delayed`. Defaults: reads **350 ms**, writes **650 ms**, classification completion **1,500 ms**. `watch*` returns a Dart `Stream`, not a `Future`; its initial snapshot/error is delayed 350 ms and later snapshots are scheduled asynchronously after successful commits. Tests can inject zero/short durations but must still exercise the asynchronous path.
- `MockApi` receives an operation name, configured latency, scenario behavior, and a body. Name operations `<feature>.<methodName>`, for example `account.getProfile`, `activity.getDeposits`, `scan.completeVerification`, and `rewards.redeemReward`, so tests can target them precisely. For writes, apply failure injection **before committing mutations**. No random failures or random ordering.
- The store holds canonical raw JSON datasets, returns defensive snapshots, and provides serialized atomic mutation transactions. Keep domain decoding inside repositories. Failed operations must leave all related datasets unchanged.
- Store persisted rows in the flat document shapes above; computed read projections and mock auth/receipt caches are separate. In `mock_data_store.dart`, define `String createDocumentId(String collection)` using an SDK-free opaque string generator (for example secure random hexadecimal characters), with injectable deterministic string IDs in tests. Never allocate Auth UIDs or derive entity primary keys from numeric counters.
- Fixtures are loaded once before repositories serve data. Maintain a manifest as each phase adds datasets; do not attempt to load files from future phases.
- Register each existing fixture subdirectory explicitly in `pubspec.yaml` when its phase creates it: Flutter asset-directory declarations are not recursive. `assets/mock/` covers `metadata.json`; account/wallet/activity/guide/scan/rewards subdirectories each need their own entry.
- Screens use async read state and separate mutation state. Show a full loading/error/empty state for initial loads; keep existing data visible while refreshing; show per-action progress and disable duplicate submissions during writes.
- Dispose controllers/listeners/text controllers. Ignore stale async filter responses using a request generation or provider-family key. Navigation away must not trigger `setState` after disposal.
- Refresh/invalidate affected providers only after successful mutations. Do not copy a balance into Home, Rewards, and Scan and increment each separately.
- Add an SDK-free revision/event stream to the existing `MockDataStore`; every repository `watch*` subscribes to it, reprojects its typed result and emits a defensive snapshot after an atomic commit. No polling, one-shot `Stream.value`, lost initial writes, stale filter emissions, or events after cancellation. Deduplicate unchanged snapshots; rollback/idempotent replay emits no data mutation. Recoverable errors use the stream error channel and can recover on Retry/resubscription.
- Prefer Riverpod `StreamProvider`/controller subscriptions for live wallet, profile, activity, session and catalog/auth state. Keep Future methods for explicit refresh, forms and CRUD; do not attach a stream and independently double-fetch the same state on every revision. Auth sign-out clears private streams/caches, emits null for nullable owner records and empty owner lists, and cancels old-user subscriptions before a different UID is observed.
- Process-lifetime persistence is enough: tab switches and screen navigation retain saved values; a fresh app process reloads the seed. Explain this in demo documentation.

### Deterministic mock baseline and scenarios

Use a fixed injected demo clock of **20 May 2024, 11:00, Asia/Kuala_Lumpur offset +08:00** to reproduce the source's Monday/May labels and make expiry tests deterministic. Store timestamps with offsets and normalize consistently in formatters; a timezone package is unnecessary for this single demo locale. Fixtures use May–July **2024**, not already-expired 2025 admin dates. A later backend implementation will supply real timestamps/clock behavior.

Baseline data:

- Resident `RES-000842`: Faris Rezza, `rezza@example.com`; opening balance 245.
- A wallet opening-balance fixture is authoritative for pre-demo earnings/spending. Do not reconstruct that historical balance from the abbreviated demo deposit history.
- Twelve verified deposits total 26 pcs and 1.04 kg derived from the fixed material conversion table, including 2 pcs PET plastic/+10 at BIN-004 today and 2 pcs aluminium/+16 at BIN-002 on 18 May. One separate 4 pcs Paper record at BIN-007 on 16 May is in review with no awarded points.
- BIN-004: Cedar Residence · Ground Floor, 65% capacity, accepts plastic/aluminium. Seed BIN-002 and BIN-007 references to match resident history; do not inherit inconsistent admin location text.
- Catalog: Vending snack/100, RM5 café voucher/200, Meal voucher/350, RM10 shopping voucher/500. One available zero-cost RM3 Welcome voucher expiring 31 May.
- Guide rates: plastic 5, aluminium 8, paper 3 points/pc. Glass is a guide material; do not invent a resident glass rate row absent from the source.

`MockScenario` must support at least these deterministic selections, injected through providers/tests or a debug `MOCK_SCENARIO` dart-define:

| Scenario key | Required effect |
|---|---|
| `normal` | Baseline successful workflow |
| `empty_activity` | No deposits, zero derived impact; independently seeded opening wallet remains valid |
| `read_error_once` | Next read fails once, then Retry succeeds |
| `write_error_once` | Next write fails once without partial mutation, then retry succeeds |
| `invalid_qr` | Lookup returns a typed invalid-bin-code failure |
| `full_bin` | Lookup returns a bin at 100%, session confirmation is unavailable |
| `review_deposit` | Classification completes in review; no points awarded |
| `rejected_deposit` | Classification rejects; zero points awarded |
| `zero_balance` | Redemption disabled; no negative wallet possible |
| `empty_rewards` | Catalog and reward progress show intentional empty/unavailable state |
| `no_vouchers` | Voucher preview/list empty state |

Tests must also be able to fail a **named operation once**, rather than relying on which widget happens to load first. Only Phase 3 creates the mechanism; later feature phases add their scenario behavior.

---

## Phase 1 — Bootstrap, dependencies, feature structure, and centralized AppTheme

**Prerequisite:** None. **Outcome:** EcoLoop bootstrap builds, fonts/icons are offline, theme tokens have one home, and later phases have a stable composition/navigation boundary.

### Source references

- `EcoLoop_AI_Figma_Design_Artifacts/src/main.tsx`.
- `EcoLoop_AI_Figma_Design_Artifacts/src/App.tsx`: `paths`, `Icon`, `Brand`, `ResidentApp`.
- `EcoLoop_AI_Figma_Design_Artifacts/src/index.css`: `:root`, headings, `.brand`, `.btn`, `.badge`, `.resident-shell`, `.mobile-top`, `.bottom-nav`, `.scanner`.
- Existing `pubspec.yaml`, `lib/main.dart`, `analysis_options.yaml`, `test/widget_test.dart`.

### Exact target files

Create:

- `lib/app/bootstrap.dart`
- `lib/app/eco_loop_app.dart`
- `lib/app/providers/app_providers.dart`
- `lib/app/router/app_router.dart`
- `lib/app/router/app_routes.dart`
- `lib/app/presentation/bootstrap_screen.dart`
- `lib/core/theme/app_theme.dart`
- `lib/core/theme/app_colors.dart`
- `lib/core/theme/app_typography.dart`
- `lib/core/theme/app_spacing.dart`
- `lib/core/theme/app_radii.dart`
- `lib/core/theme/app_shadows.dart`
- `lib/core/theme/app_motion.dart`
- `lib/core/theme/eco_theme_extension.dart`
- `lib/core/presentation/app_copy.dart`
- `lib/core/presentation/app_formatters.dart`
- `assets/fonts/Inter-Regular.ttf`
- `assets/fonts/Inter-SemiBold.ttf`
- `assets/fonts/Inter-Bold.ttf`
- `assets/fonts/Inter-ExtraBold.ttf`
- `assets/fonts/OFL.txt`
- `assets/icons/leaf.svg`
- `assets/icons/home.svg`
- `assets/icons/scan.svg`
- `assets/icons/settings.svg`
- `assets/icons/bell.svg`
- `assets/icons/arrow.svg`
- `assets/icons/recycle.svg`
- `assets/icons/gift.svg`
- `assets/icons/history.svg`
- `assets/icons/book.svg`
- `assets/icons/check.svg`
- `assets/icons/bin.svg`
- `assets/icons/alert.svg`
- `assets/icons/search.svg`
- `assets/icons/shield.svg`
- `assets/icons/close.svg`
- `assets/icons/camera.svg`
- `docs/FLUTTER_UI_EXECUTION_LOG.md`

Modify `pubspec.yaml`, `pubspec.lock`, `lib/main.dart`, and `test/widget_test.dart`; adjust `README.md` to describe the app and mock launch command. Do not regenerate the existing Android/iOS/web projects.

### Strict Phase 1 guardrails — existing Android Firebase configuration

**DO NOT OVERWRITE OR MODIFY any of these three user-configured files, even for formatting, plugin updates, dependency setup, application-ID changes or build troubleshooting:**

1. `android/build.gradle.kts`
2. `android/app/build.gradle.kts`
3. `android/app/google-services.json`

Do not regenerate/copy Gradle templates, change Google Services plugin configuration, replace `google-services.json`, run `flutter create .`, run `flutterfire configure`, or run `firebase init`. Record a pre-phase checksum baseline and preserve any pre-existing user diffs. If a build appears to require changing a protected file, stop and report the exact blocker; do not reset, amend or “repair” that configuration. This protection applies to every subsequent UI phase as well.

**Mock-only guardrail:** Do not initialize/call Firebase Auth, Firestore, Storage or App Check; do not deploy Hosting or connect to emulators. Existing native Firebase setup is preserved, not used as permission to connect the Goal 1 app to Firebase services.

### Styling contract

| Token/group | Exact source values / planned mapping |
|---|---|
| Brand | primary `#176B45`, dark `#0F5235`, sage `#DDEBDD`, mint `#EDF5EE` |
| Surfaces/text | background `#F8FAF6`, surface `#FFFFFF`, text `#202820`, muted `#687268`, border `#E2E8E0` |
| Status | amber `#F2B544`, amber background `#FFF7E5`, red `#D9534F`, red background `#FFF0EF`, blue `#477C91` |
| Badge text/surface | amber text `#875B06`, red text `#A23632`, gray text `#626A62`, gray background `#F0F2EF` |
| Scanner | dark surface `#16251D`, corner green `#65BF8F`; extract remaining scanner tints from `.scanner`/`.scan-frame` |
| Typography | Offline Inter, regular/semibold/bold/extra-bold mapped to 400/600/700/800; use the nearest bundled weight for source 650/750 |
| Text scale | Page H1 29 with 1.15 height and approximately -1.16 tracking; home H1 25; H2 19 with -0.38 tracking; H3 15; body 14; labels 11–13; wallet number 44; eyebrow 11, weight 800, tracking 1.21 |
| Geometry | Base radius 16; buttons 12; points/scanner 22; scan CTA 18; chips fully rounded; retain component-specific radii in named tokens |
| Spacing | Centralize used values 4/5/6/7/8/9/10/12/13/14/15/16/18/20/22/24/26/28/32 rather than inventing arbitrary widget padding |
| Elevation | Main shadow: offset (0,8), blur 28, `#183423` at 8%; extract scan-button shadow separately |
| Layout | Resident max content frame 480 logical pixels, page padding 20, header 72, bottom bar content 78, source stack gap 22 |
| Motion | Button feedback 200 ms; scan rotation 2 seconds; respect reduced-motion preferences |

Implement `ThemeData` plus a typed `ThemeExtension` for semantic status/scanner/reward-art tokens not covered by `ColorScheme`. Configure button/input/card/chip/dialog/snackbar themes centrally. Material defaults must not introduce purple tint, oversized typography, or incompatible rounded shapes. Keep one light theme; the artifact has no dark-theme specification.

Extract each listed SVG from its matching inline `paths` entry, preserving `viewBox`, stroke width/caps/joins. Obtain the licensed Inter font files and include their license; the artifact does not supply them. Use theme-driven SVG tinting rather than fixed icon colors.

### Models and mock methods

No feature data models or repositories are introduced here. `AppRoutes` contains the final path/name constants from Phase 9, but the initial router registers only a branded bootstrap route and an error fallback. `bootstrap_screen.dart` is a temporary app-loading surface, not a dummy dashboard. Feature route registrations are added as their screens become available; the temporary bootstrap is retired in Phase 9.

### Verification checklist

- [ ] Before and after the phase, run `Get-FileHash -Algorithm SHA256 -LiteralPath "android/build.gradle.kts", "android/app/build.gradle.kts", "android/app/google-services.json"` from the repository root and compare all three hashes to the recorded baseline. Do not print/reset file contents or discard existing user changes.
- [ ] Mock startup has no Firebase initialization, live SDK calls, emulator traffic, FlutterFire reconfiguration or Hosting deployment; existing configuration/dependencies remain intact.
- [ ] `flutter pub get` succeeds with SDK-compatible dependencies; `dart format --output=none --set-exit-if-changed lib test` and `flutter analyze` pass.
- [ ] Replace the counter test with an EcoLoop bootstrap smoke test; `flutter test test/widget_test.dart` passes.
- [ ] `flutter build web` succeeds; resident frame is centered at 480 maximum width and does not become an admin/desktop layout.
- [ ] Check 320, 390, and 480 widths; no fixed-height body prevents scrolling or clips content under device insets.
- [ ] Fonts and icons render offline. Source font/icon origins and fidelity decisions are recorded in `docs/FLUTTER_UI_EXECUTION_LOG.md`.

---

## Phase 2 — Reusable shared UI and feedback components

**Prerequisite:** Phase 1. **Outcome:** Feature screens can be assembled without duplicating controls or styling.

### Source references

- `EcoLoop_AI_Figma_Design_Artifacts/src/App.tsx`: `Icon`, `Button`, `Badge`, `Brand`; repeated activity/profile/section markup in `ResidentHome`, `History`, `Rewards`, `ResidentSettings`.
- `EcoLoop_AI_Figma_Design_Artifacts/src/index.css:13–22`: `.btn`, `.badge`, `.avatar`, `.icon-btn`, `.section-head`, `.activity-list`, `.point-pill`, `.filter-row`, `.success-banner`, `.profile`.
- Forms/modals are UI extensions; derive their surfaces and spacing from the resident controls, not the admin drawer.

### Exact target files

Create:

- `lib/shared/widgets/app_icon.dart`
- `lib/shared/widgets/app_brand.dart`
- `lib/shared/widgets/app_button.dart`
- `lib/shared/widgets/app_icon_button.dart`
- `lib/shared/widgets/app_text_field.dart`
- `lib/shared/widgets/app_dropdown_field.dart`
- `lib/shared/widgets/app_switch_tile.dart`
- `lib/shared/widgets/app_card.dart`
- `lib/shared/widgets/app_badge.dart`
- `lib/shared/widgets/app_avatar.dart`
- `lib/shared/widgets/app_page.dart`
- `lib/shared/widgets/app_page_header.dart`
- `lib/shared/widgets/app_section_header.dart`
- `lib/shared/widgets/app_filter_chip.dart`
- `lib/shared/widgets/app_points_pill.dart`
- `lib/shared/widgets/app_progress_bar.dart`
- `lib/shared/widgets/app_confirmation_dialog.dart`
- `lib/shared/widgets/app_bottom_sheet.dart`
- `lib/shared/widgets/app_feedback_banner.dart`
- `lib/shared/widgets/app_loading_view.dart`
- `lib/shared/widgets/app_error_view.dart`
- `lib/shared/widgets/app_empty_view.dart`
- `test/shared/widgets/shared_components_test.dart`

Modify theme files and `lib/core/presentation/app_copy.dart` only when an extracted shared token or fixed label is missing.

### Component contracts and local interaction

- `AppButton`: primary/secondary/danger/ghost variants, label, optional leading/trailing icon, callback, disabled and loading flags. Loading preserves dimensions and prevents repeated callbacks.
- Input components: externally controlled values, label/helper/error copy, keyboard/action configuration, obscured-password option, validator, focus/submit behavior. Form data is never embedded in the component.
- Cards: plain/bordered/elevated surfaces; optional semantic tap action; no repository access.
- Badges: semantic green/amber/red/gray tones; label supplied by parent. Do not infer status by comparing localized strings.
- Dialog/sheet: supplied heading/body/content/actions, cancel/confirm result, pending state and inline failure. Constrain width on desktop, account for keyboard insets, and restore focus when closed.
- `AppPage`/headers: responsive scrollable body, optional back action, title/eyebrow/trailing slot; they do not instantiate a second shell or hardcode route strings.
- Loading/error/empty/feedback: supplied copy and callbacks, visible retry, accessible live feedback. Initial load failure and empty success are distinct states.
- Keep transaction tiles, reward cards, bin visuals, and guide material cards feature-owned; shared widgets should not import those domain models.

### Models and mock methods

No domain models or mock repositories are needed. Component enums such as button variant/badge tone are presentation configuration. Test data is supplied by test hosts; do not create fake customer records or catalog arrays inside shared production widgets.

### Verification checklist

- [ ] `flutter test test/shared/widgets/shared_components_test.dart` covers disabled/loading button behavior, form errors, and modal confirm/cancel behavior.
- [ ] Keyboard navigation, visible focus, semantic labels, and enlarged text work; touch targets are at least 48 logical pixels even where the source visual is 38–44.
- [ ] Dialogs/sheets fit narrow screens with the keyboard visible and do not lose entered form data on validation failure.
- [ ] All components use AppTheme tokens; they can render without a repository/provider dependency.
- [ ] Common formatting/analyzer/full-test gate passes.

---

## Phase 3 — Shared mock foundation, resident account identity, wallet, and activity contracts

**Prerequisite:** Phases 1–2. **Outcome:** Canonical typed data and realistic async behavior are available before dashboard/history widgets consume them.

### Source references

- `EcoLoop_AI_Figma_Design_Artifacts/src/App.tsx`: `transactions`, `ResidentApp` points state, `ResidentHome` impact/progress fields, `History`, `ResidentSettings` profile.
- `EcoLoop_AI_Figma_Design_Artifacts/src/index.css`: wallet/points/activity/status styling establishes display requirements, not storage types.

### Exact target files

Create:

- `lib/core/data/app_failure.dart`
- `lib/core/data/json_readers.dart`
- `lib/core/domain/material_type.dart`
- `lib/features/account/domain/models/auth_state.dart`
- `lib/core/mock/app_clock.dart`
- `lib/core/mock/mock_api.dart`
- `lib/core/mock/mock_scenario.dart`
- `lib/core/mock/mock_data_store.dart`
- `lib/core/mock/mock_seed_loader.dart`
- `lib/features/account/domain/models/resident_profile.dart`
- `lib/features/account/domain/repositories/account_repository.dart`
- `lib/features/account/data/mock_account_repository.dart`
- `lib/features/account/presentation/controllers/account_providers.dart`
- `lib/features/wallet/domain/models/wallet_snapshot.dart`
- `lib/features/wallet/domain/repositories/wallet_repository.dart`
- `lib/features/wallet/data/mock_wallet_repository.dart`
- `lib/features/wallet/presentation/controllers/wallet_providers.dart`
- `lib/features/activity/domain/models/deposit_transaction.dart`
- `lib/features/activity/domain/models/deposit_filter.dart`
- `lib/features/activity/domain/models/recycling_summary.dart`
- `lib/features/activity/domain/repositories/activity_repository.dart`
- `lib/features/activity/data/mock_activity_repository.dart`
- `lib/features/activity/presentation/controllers/activity_providers.dart`
- `assets/mock/metadata.json`
- `assets/mock/account/profile.json`
- `assets/mock/wallet/wallet.json`
- `assets/mock/activity/deposits.json`
- `test/core/mock/mock_data_store_test.dart`
- `test/features/account/account_models_test.dart`
- `test/features/wallet/mock_wallet_repository_test.dart`
- `test/features/activity/mock_activity_repository_test.dart`

Modify `lib/app/bootstrap.dart`, `lib/app/providers/app_providers.dart`, `lib/core/presentation/app_formatters.dart`, and `pubspec.yaml` for fixture directories. Load only the datasets introduced so far.

### Models: exact required fields

| Model / supporting enum | Fields and constraints |
|---|---|
| `MaterialType` | Wire values `plastic`, `aluminium`, `paper`, `glass`, `unknown`; unknown is a controlled classification fallback, never automatically reward-eligible. |
| `AppRole` / `AuthState` | Wire roles `user`, `admin`; `AuthState` fields `uid: String?`, `role: AppRole?`, `isSignedIn: bool`. Claims/state projection only; not a stored Firestore profile. |
| `ResidentProfile` | `id: String` equal to Auth UID, `fullName: String`, `email: String`, `avatarUrl: String?`, `createdAt: DateTime`. First name and initials are derived. Seed `avatarUrl: null`; do not activate Storage. |
| `WalletSnapshot` | `residentId: String`, `balance: int`, `nextRewardCost: int?`, `updatedAt: DateTime`, `version: int`. Balance/version nonnegative; next cost is the next configured active cost strictly above balance, or null. |
| `WalletDocument` | `residentId: String`, `balance: int`, `updatedAt: DateTime`, `version: int`; stored form omits computed `nextRewardCost`. Define in `wallet_snapshot.dart`. |
| `DepositStatus` | Wire values `verified`, `review`, `rejected`, `unknown`; unknown receives no credit. |
| `DepositTransaction` | `id: String`, `residentId: String`, `sessionId: String?`, `binId: String`, `binLocation: String`, `materialType: MaterialType`, `materialLabel: String`, `itemCount: int`, `pointsAwarded: int?`, `status: DepositStatus`, `occurredAt: DateTime`, `verifiedAt: DateTime?`. Review points are null, rejected points zero, verified points nonnegative. |
| `DepositFilter` | `from: DateTime?`, `toExclusive: DateTime?`, `status: DepositStatus?`. Null means unrestricted; reject an inverted date range. |
| `RecyclingSummary` | `verifiedDepositCount: int`, `verifiedWeightKg: double`. Derived only from verified records belonging to the active resident. |

`metadata.json` contains `referenceNow`, `locale` (`en_MY`), and `utcOffsetMinutes` (480). `wallet.json` is an envelope with exact keys `wallet: WalletDocument` and `rewardCosts: List<int>` ([100,200,350,500]); the repository composes WalletSnapshot and derives `nextRewardCost`, never stores that projection in the wallet document. The reward catalog must agree once Phase 7 is added. Other collection files use `items` arrays and singleton files one flat record unless a phase explicitly defines an envelope. Models serialize their records, not fixture envelopes. Initial AuthState is transient mock metadata `{uid: "RES-000842", role: "user", isSignedIn: true}`.

`AppFailure` carries a stable `code`, a fixed-copy message key, and `retryable: bool`; no raw exception/stack trace is displayed in a widget. Minimum codes: `unavailable`, `invalidData`, `notFound`, `validation`, `conflict`, `insufficientPoints`, `invalidQr`, `binUnavailable`, `invalidTransition`, `unauthenticated`, `permissionDenied`. It is an application error type, not a JSON entity.

### Repository interfaces and mock methods

The one-shot methods below return `Future` and use `MockApi`/`Future.delayed`; reactive counterparts return the explicitly listed `Stream` types.

| Interface | Method contract | Mock responsibility |
|---|---|---|
| `AccountRepository` | `getProfile()` → `ResidentProfile` | Read active resident's canonical profile. Extended in Phase 8. |
| `WalletRepository` | `getWallet()` → `WalletSnapshot` | Read canonical wallet; compute next cost and clamp display progress only in presentation. No public “set balance” method. |
| `ActivityRepository` | `getDeposits(filter: DepositFilter, limit: int?)` → `List<DepositTransaction>` | Filter by resident/date/status, newest-first, stable ID tie-break; limit after filtering. |
| `ActivityRepository` | `getSummary()` → `RecyclingSummary` | Derive impact from canonical verified records. |

Add these exact Dart interface signatures in the existing repository files (method declarations here specify API, not implementation bodies):

```dart
// account_repository.dart; mock UID is RES-000842 with role user initially.
Future<AuthState> getAuthState();
Stream<AuthState> watchAuthState();
Stream<ResidentProfile?> watchProfile();
// wallet_repository.dart
Stream<WalletSnapshot?> watchWallet();
// activity_repository.dart
Stream<List<DepositTransaction>> watchDeposits({required DepositFilter filter, int? limit});
Stream<RecyclingSummary> watchSummary();
```

Phase 3 establishes signed-in mock auth state; Phase 8 connects demo sign-out/resume to that same state. Future Firebase adapters map UID/claim changes to `watchAuthState` and Firestore snapshots to the data streams. No SDK import or network listener is needed to implement these streams now.

The store's transaction mechanism is internal infrastructure, not an alternate public repository for widget writes. It must later support atomic scan credit/history insertion and atomic reward debit/voucher insertion.

### Verification checklist

- [ ] Round-trip profile, wallet, filter, summary, and nested/enum/date deposit JSON. Test nullable pending points, integer JSON item counts, malformed required data, and unknown status behavior.
- [ ] Fixture integrity: 12 verified deposits, 26 verified items, 1.04 kg derived total, one separate review record; opening balance 245 and next target 350.
- [ ] Reads show a real asynchronous boundary; named read-failure-once then retry succeeds. `empty_activity` returns zero derived impact without crashing.
- [ ] SDK-free ISO/native-date/Timestamp-parts conversions preserve instants; document round-trips validate string IDs and never persist AuthState, credentials or computed wallet fields.
- [ ] Subscribe before/after a mock write: initial event is delayed, later wallet/profile/activity events match committed state and no event leaks after cancellation. Simulated auth-fixture UID/role changes emit correct state without Firebase; full sign-out/resume UI is verified in Phase 8.
- [ ] Store transactions roll back on failure and do not expose mutable references to callers. Fresh test containers do not share state.
- [ ] `flutter test test/core/mock test/features/account test/features/wallet test/features/activity` and common gate pass; app bootstrap still builds with loaded fixtures.

---

## Phase 4 — Home dashboard and recycling history

**Prerequisite:** Phases 1–3. **Outcome:** First resident screens are data-backed, with working filters, refresh, and consistent summaries.

### Source references

- `EcoLoop_AI_Figma_Design_Artifacts/src/App.tsx`: `ResidentHome`, `History`, `transactions`, header notification callback in `ResidentApp`.
- `EcoLoop_AI_Figma_Design_Artifacts/src/index.css`: `.greeting`, `.points-card`, `.scan-cta`, `.stats`, `.quick-grid`, `.activity-list`, `.history-item`, `.filter-row`, `.demo-note`.

### Exact target files

Create:

- `lib/features/home/presentation/controllers/home_controller.dart`
- `lib/features/home/presentation/screens/home_screen.dart`
- `lib/features/home/presentation/widgets/home_greeting.dart`
- `lib/features/home/presentation/widgets/wallet_summary_card.dart`
- `lib/features/home/presentation/widgets/scan_call_to_action.dart`
- `lib/features/home/presentation/widgets/impact_summary_card.dart`
- `lib/features/home/presentation/widgets/home_quick_actions.dart`
- `lib/features/activity/presentation/controllers/history_controller.dart`
- `lib/features/activity/presentation/screens/history_screen.dart`
- `lib/features/activity/presentation/widgets/deposit_activity_tile.dart`
- `lib/features/activity/presentation/widgets/history_filter_sheet.dart`
- `test/features/home/home_screen_test.dart`
- `test/features/activity/history_screen_test.dart`

Modify `lib/app/router/app_router.dart`, `lib/core/presentation/app_copy.dart`, `lib/core/presentation/app_formatters.dart`, and `test/widget_test.dart` to keep the bootstrap smoke test aligned with the new initial screen. Register `/home` and `/history` and make `/home` the normal initial data screen. The shell is finalized in Phase 9.

### Models and mock methods used

Use `ResidentProfile`, `WalletSnapshot`, `DepositTransaction`, `DepositFilter`, and `RecyclingSummary` from Phase 3 without duplicating them. No new serializable model or `HomeRepository` is necessary. `HomeController` composes `watchProfile()`, `watchWallet()`, `watchSummary()`, and `watchDeposits(filter: unrestricted, limit: 2)` into UI-only state; Future reads remain available for explicit refresh/retry.

`HistoryController` owns selected date/status filters and switches/cancels `watchDeposits` subscriptions when they change, retaining `getDeposits` for explicit one-shot reads. Date presets are **All dates / Today / Last 7 days / This month / Custom range**; statuses are **All / Verified / Review / Rejected**. These are structural filter choices mapped to typed parameters, not fake transaction content. Convert inclusive date-picker end dates into `toExclusive` using calendar-day boundaries, not a fabricated 23:59:59 timestamp.

### Behavior and state

- Greeting/date/name/initials use profile and injected clock. Wallet progress and “points to next reward” are computed from numeric fields; null next target has a clear “all current reward levels unlocked” state.
- The home dashboard's opening wallet, impact, and recent list come from repositories. `Recent recycling` uses two newest records and displays each actual status, not a hardcoded Verified badge.
- Home CTAs resolve named routes for rewards, scanner, guide, and history; their connected journeys are verified when those routes exist. Do not add local page-name switching to mimic React.
- History filters open an accessible sheet/dialog; Apply reloads asynchronously, Cancel preserves the previous filter, Reset restores unrestricted values.
- Rapid filter changes must not let a stale response replace newer results. Keep filter controls usable when results are empty.
- Pull-to-refresh re-reads canonical data. Initial failure shows Retry; refresh failure retains the last successful data plus feedback.
- Format verified points with a plus sign, review as Pending, rejected as zero/not eligible; use the status enum and theme tones.

### Verification checklist

- [ ] Home shows Faris/FR, 245 points, computed 105 remaining/70%, 12 deposits and 1.04 kg derived from 26 verified items.
- [ ] Changing injected fixture values changes the UI without modifying any widget. Empty activity and failed reads render intentional states.
- [ ] Date/status/custom-range filters produce correct results, survive widget rebuilds, and handle rapid changes and Retry.
- [ ] `flutter test test/features/home test/features/activity` passes; pump a bounded duration for loading spinners instead of settling an infinite animation.
- [ ] At 320/390/480 widths and enlarged text, the wallet, quick actions, and trailing transaction amounts do not overflow.
- [ ] Common gate passes; `/home` and `/history` can be opened independently through their registered routes.

---

## Phase 5 — Recycling guide and configured point-rate content

**Prerequisite:** Phases 1–4. **Outcome:** Every guide list/table is repository content, and scan classification can later reuse the same material-rate rules.

### Source references

- `EcoLoop_AI_Figma_Design_Artifacts/src/App.tsx`: `RecycleGuide`, its `items`, do/avoid paragraphs, five steps, and illustrative rates.
- `EcoLoop_AI_Figma_Design_Artifacts/src/index.css`: `.guide-hero`, `.material-grid`, `.dos`, `.steps`, `.rates`, `.fine`.

### Exact target files

Create:

- `lib/features/recycling_guide/domain/models/recycling_material.dart`
- `lib/features/recycling_guide/domain/models/recycling_step.dart`
- `lib/features/recycling_guide/domain/models/material_rate.dart`
- `lib/features/recycling_guide/domain/models/recycling_guide.dart`
- `lib/features/recycling_guide/domain/models/recycling_guide_content.dart`
- `lib/features/recycling_guide/domain/repositories/recycling_guide_repository.dart`
- `lib/features/recycling_guide/data/mock_recycling_guide_repository.dart`
- `lib/features/recycling_guide/presentation/controllers/recycling_guide_controller.dart`
- `lib/features/recycling_guide/presentation/screens/recycling_guide_screen.dart`
- `lib/features/recycling_guide/presentation/widgets/material_guide_card.dart`
- `lib/features/recycling_guide/presentation/widgets/recycling_steps_list.dart`
- `lib/features/recycling_guide/presentation/widgets/material_rates_table.dart`
- `assets/mock/recycling_guide/guide.json`
- `test/features/recycling_guide/recycling_guide_test.dart`

Modify `lib/app/providers/app_providers.dart`, `lib/app/router/app_router.dart`, `lib/core/mock/mock_seed_loader.dart`, `lib/core/presentation/app_copy.dart`, and `pubspec.yaml`; register `/guide`, add the new fixture to the manifest, and declare `assets/mock/recycling_guide/`.

### Models: exact required fields

| Model | Fields |
|---|---|
| `RecyclingMaterial` | `id: String`, `type: MaterialType`, `title: String`, `preparationTip: String`, `iconKey: String`, `sortOrder: int` |
| `RecyclingStep` | `id: String`, `order: int`, `instruction: String` |
| `MaterialRate` | `materialType: MaterialType`, `displayName: String`, `pointsPerItem: int`, `eligible: bool`; rates are integer points per piece and have no weight fields. |
| `RecyclingGuideContent` | `id: String`, `heroTitle: String`, `heroDescription: String`, `toDo: List<String>`, `toAvoid: List<String>`, `pointsDisclaimer: String`; flat stored content, default `id` is `guide-default`. |
| `RecyclingGuide` | `id: String`, `heroTitle: String`, `heroDescription: String`, `materials: List<RecyclingMaterial>`, `toDo: List<String>`, `toAvoid: List<String>`, `steps: List<RecyclingStep>`, `rates: List<MaterialRate>`, `pointsDisclaimer: String` |

All models implement JSON round-trips; persisted content/material/step/rate records also implement flat map serialization. `RecyclingGuide` is a composed read response, not a document writer. `guide.json` is a fixture envelope with exact keys `content: RecyclingGuideContent`, `materials: List<RecyclingMaterial>`, `steps: List<RecyclingStep>`, `rates: List<MaterialRate>`; the repository assembles the guide. `iconKey` maps through an allowlist; unknown keys use a generic recycle icon.

### Repository and mock method

`RecyclingGuideRepository.getGuide()` → `Future<RecyclingGuide>`: delayed fixture read, stable material/step ordering, and normal read failure behavior. Seed plastic/glass/metal/paper cards, the three source do/avoid items per column, the five source instructions, and the plastic/aluminium/paper rate examples. Use count examples 2/2/4 pcs to yield 10/16/12 points. Weight examples in educational copy may show the fixed kg-per-piece conversion, but never determine points.

Also declare `Stream<RecyclingGuide> watchGuide();` in that same interface and implement a delayed initial snapshot plus updates when mock guide/rate documents change. Use the stream for displayed guide content; retain the Future method for one-shot reads. No Firestore SDK listener is connected in this goal.

### Verification checklist

- [ ] All guide content comes from `getGuide()`, including do/avoid lists, steps, disclaimer, and rate rows.
- [ ] Nested JSON round-trip and example calculations pass; the displayed point rules are suitable for reuse by the scan repository.
- [ ] Guide loading/failure/Retry works; empty optional lists omit their section cleanly.
- [ ] Two-column cards and rate table remain legible at 320 width; adapt to a single column when text scaling requires it.
- [ ] `/guide` opens directly; back behavior is connected in Phase 9. `flutter test test/features/recycling_guide` and common gate pass.

---

## Phase 6 — Six-stage smart-bin scan/deposit flow

**Prerequisite:** Phases 1–5. **Outcome:** A realistic, resumable-in-process simulated deposit updates canonical resident data, with no physical integrations.

### Source references

- `EcoLoop_AI_Figma_Design_Artifacts/src/App.tsx`: `ScanFlow`, `ResidentApp.beginScan`, `nextScan`, `onDepositVerified` callback.
- `EcoLoop_AI_Figma_Design_Artifacts/src/index.css`: `.flow-page`, `.scanner`, `.scan-frame`, `.bin-visual`, `.pulse`, `.loader`, `.success-ring`, `.flow-info`, `.bin-details`, `.credit`, `.warning`.
- `RecycleGuide` instructions/rates for rule consistency; root `App` capacity is context only.

### Exact target files

Create:

- `lib/features/scan/domain/models/smart_bin.dart`
- `lib/features/scan/domain/models/scan_instructions.dart`
- `lib/features/scan/domain/models/deposit_session.dart`
- `lib/features/scan/domain/models/deposit_result.dart`
- `lib/features/scan/domain/repositories/scan_repository.dart`
- `lib/features/scan/data/mock_scan_repository.dart`
- `lib/features/scan/presentation/controllers/scan_controller.dart`
- `lib/features/scan/presentation/screens/scan_screen.dart`
- `lib/features/scan/presentation/screens/scan_session_screen.dart`
- `lib/features/scan/presentation/widgets/scanner_frame.dart`
- `lib/features/scan/presentation/widgets/bin_session_visual.dart`
- `lib/features/scan/presentation/widgets/bin_details_card.dart`
- `lib/features/scan/presentation/widgets/deposit_result_card.dart`
- `assets/mock/scan/bins.json`
- `assets/mock/scan/instructions.json`
- `assets/mock/scan/classification_scenarios.json`
- `assets/mock/scan/sessions.json`
- `assets/mock/scan/results.json`
- `test/features/scan/mock_scan_repository_test.dart`
- `test/features/scan/scan_flow_test.dart`

Modify `lib/app/providers/app_providers.dart`, `lib/core/mock/mock_seed_loader.dart`, `lib/core/mock/mock_scenario.dart`, `lib/app/router/app_router.dart`, `lib/core/presentation/app_copy.dart`, `lib/core/presentation/app_formatters.dart`, and `pubspec.yaml` (declare `assets/mock/scan/`). Register `/scan` and all session paths in the Phase 9 route table. `sessions.json` and `results.json` start with empty `items` arrays; separate flat session/result records live in the shared store. The `bins.json` envelope includes `demoQrPayload` in addition to its `items` array.

### Models: exact required fields

| Model / enum | Fields |
|---|---|
| `SmartBin` | `id: String`, `locationName: String`, `locationDetail: String`, `capacityPercent: int`, `acceptedMaterials: List<MaterialType>`, `isOnline: bool`, `lastUpdatedAt: DateTime`; percentage within 0–100. |
| `ScanStage` | Wire values `binFound`, `ready`, `itemDetected`, `processing`, `completed`, `cancelled`. The scanner itself has no session yet. |
| `DepositOutcome` | Wire values `verified`, `review`, `rejected`, `unknown`; unknown never earns points. |
| `ScanInstructions` | `id: String` equal to `default`, `scannerTitle: String`, `scannerDescription: String`, `binFoundTitle: String`, `readyTitle: String`, `readyDescription: String`, `itemDetectedTitle: String`, `itemDetectedDescription: String`, `processingTitle: String`, `processingDescription: String`, `verifiedTitle: String`, `reviewTitle: String`, `rejectedTitle: String`, `pointsTimingNotice: String` |
| `DepositSession` | `id: String`, `residentId: String`, `binId: String`, `stage: ScanStage`, `createdAt: DateTime`, `updatedAt: DateTime`, `creationRequestId: String`, `resultId: String?`; result lives in a separate document. |
| `DepositResult` | `id: String`, `sessionId: String`, `transactionId: String`, `outcome: DepositOutcome`, `materialType: MaterialType`, `materialLabel: String`, `itemCount: int`, `pointsAwarded: int?`, `classifiedAt: DateTime`, `explanation: String` |

Keep current bin details in the canonical bin dataset and resolve them by `binId`; do not serialize widget illustrations into a session. Classification fixtures provide material/itemCount/outcome/explanation and simulated capacity increase. Verified points are calculated as `itemCount × pointsPerItem` from the guide rate dataset, not copied from display text. Session results and activity records must agree.

### Repository interface and mock methods

The one-shot methods below are on `ScanRepository` and return `Future<…>`; reactive counterparts following the table return `Stream`:

| Method contract | Result / behavior |
|---|---|
| `getInstructions()` | `ScanInstructions`; delayed content read. |
| `getDemoQrPayload()` | `String`; returns a mock QR payload from the scan fixture, keeping even the simulated bin ID out of widgets. |
| `lookupBin(qrPayload: String)` | `SmartBin`; validate payload, resolve ID, distinguish invalid/unknown/offline/full bin cases. |
| `getBin(binId: String)` | `SmartBin`; resolve session details and deep links. |
| `createSession(binId: String, requestId: String)` | `DepositSession` in `binFound`; same request ID returns the same session; validate availability. |
| `getSession(sessionId: String)` | `DepositSession`; not-found is a recoverable UI failure. |
| `getResult(resultId: String)` | `DepositResult`; resolve the session's string reference without an embedded result map. |
| `confirmSession(sessionId: String)` | `DepositSession` in `ready`; validate transition and bin availability again. |
| `reportFinishPressed(sessionId: String)` | `DepositSession` in `itemDetected`; explicitly a simulated hardware event. |
| `startVerification(sessionId: String)` | `DepositSession` in `processing`; commits that state before navigating to processing. |
| `completeVerification(sessionId: String)` | `DepositSession` in `completed` with non-null `resultId`; delayed 1,500 ms, idempotent finalization of separate session/result/activity/wallet records. |
| `cancelSession(sessionId: String)` | `DepositSession` in `cancelled`; allowed only before processing; no credit/history insertion. |

Reactive signatures in the same `ScanRepository`: `Stream<SmartBin?> watchBin(String binId);`, `Stream<DepositSession?> watchSession(String sessionId);`, `Stream<DepositResult?> watchResult(String resultId);`. These SDK-free streams drive live capacity/stage/result UI; `getResult` remains the explicit async lookup. Subscribe to the result only after a non-null `resultId` is known and cancel both subscriptions when leaving/changing sessions. Goals 3–4 replace the sources with Firestore snapshots, not the interface.

### State machine and interaction contract

1. **Scanner** `/scan`: show dark camera-simulation frame and cancel/back; pressing Simulate QR scan performs payload read/lookup/session creation, with busy/error/Retry behavior.
2. **Bin found** `…/bin`: show BIN-004, location, accepted materials, and capacity warning at 65%; Confirm session moves to ready.
3. **Ready** `…/ready`: show instructions to insert items and press the physical red finish button; the local confirmation invokes `reportFinishPressed`.
4. **Item detected** `…/detected`: show internal camera visual. Continue invokes `startVerification` and navigates to processing.
5. **Identifying** `…/processing`: run `completeVerification` once per session via the controller. Animation represents a delayed operation, not a second balance mutation. Failure leaves a retryable processing session. Do not require a user to approve AI eligibility with the prototype's “Complete verification” shortcut.
6. **Result** `…/result`: show verified/review/rejected outcome from `DepositResult`. Verified default is 2 pcs PET plastic / +10 pts. Review says no credit pending review; rejected shows no earned points. Back to home clears the active UI selection, not the stored history.

Atomic successful finalization creates exactly one activity record and result, updates bin capacity from 65% to 85% for the baseline fixture, and increments the wallet by 10 **only for verified eligibility**. For baseline verification, balance becomes 255, verified count 13, verified item count 28, and verified weight 1.09 kg derived from the fixed conversion table. Review/rejection may create their corresponding activity record but do not increase verified impact or wallet. Never overwrite the unrelated opening history review record.

Repeated finalization returns the previous result and must not apply capacity/points twice. Disable duplicate taps, enforce transitions in the repository, and guard concurrent calls at the store. Invalid step URLs redirect to the session's canonical current route; changing a URL cannot award points or skip states.

Before processing, leaving an active session presents a shared cancel/continue confirmation. While processing, leaving is allowed without cancelling the in-flight completion; the app-scoped operation may finish, and reopening the session resolves its current state. A fresh process has no persisted session unless supplied by a fixture; handle stale links gracefully. Do not use `pumpAndSettle` while the processing animation runs.

### Verification checklist

- [ ] Model/map round-trips use flat session `resultId` and separate results, nullable review points, dates, unknown outcome, and all stage values; no stored document embeds a result object.
- [ ] Stage/bin/result streams emit the final committed snapshot once and stop after cancellation; no Firebase initialization/network listener is used.
- [ ] Happy path displays all six visuals, starts at scanner, and updates wallet/history/impact exactly once.
- [ ] Duplicate create/complete calls, invalid transitions, repeated result visits, and rapid taps cannot produce duplicate credit or history.
- [ ] Invalid QR, 100%-full bin, offline bin test override, read failure, completion failure/retry, review, rejection, and cancellation all behave coherently.
- [ ] Leaving/reopening processing does not restart credit; missing-session and malformed-parameter links show recovery actions.
- [ ] `flutter test test/features/scan` and common gate pass; the flow needs no camera permission or external service.

---

## Phase 7 — Rewards catalog, redemption, and owned vouchers

**Prerequisite:** Phases 1–6. **Outcome:** All rewards are actionable, every debit is coherent, and the prototype's voucher affordances lead to real mock-backed screens.

### Source references

- `EcoLoop_AI_Figma_Design_Artifacts/src/App.tsx`: `Rewards`, catalog array, category badges, redemption banner, `My vouchers` preview, resident wallet mutation.
- `EcoLoop_AI_Figma_Design_Artifacts/src/index.css`: `.point-pill`, `.category-row`, `.reward-grid`, `.reward-card`, `.reward-art`, `.voucher`, `.success-banner`.
- Voucher list/detail and confirmation are UI extensions derived from these surfaces; do not import `AdminVouchers` functionality.

### Exact target files

Create:

- `lib/features/rewards/domain/models/reward_category.dart`
- `lib/features/rewards/domain/models/reward.dart`
- `lib/features/rewards/domain/models/resident_voucher.dart`
- `lib/features/rewards/domain/models/reward_redemption.dart`
- `lib/features/rewards/domain/repositories/rewards_repository.dart`
- `lib/features/rewards/data/mock_rewards_repository.dart`
- `lib/features/rewards/presentation/controllers/rewards_controller.dart`
- `lib/features/rewards/presentation/controllers/vouchers_controller.dart`
- `lib/features/rewards/presentation/screens/rewards_screen.dart`
- `lib/features/rewards/presentation/screens/vouchers_screen.dart`
- `lib/features/rewards/presentation/screens/voucher_detail_screen.dart`
- `lib/features/rewards/presentation/widgets/reward_card.dart`
- `lib/features/rewards/presentation/widgets/reward_redemption_dialog.dart`
- `lib/features/rewards/presentation/widgets/voucher_tile.dart`
- `assets/mock/rewards/categories.json`
- `assets/mock/rewards/catalog.json`
- `assets/mock/rewards/vouchers.json`
- `assets/mock/rewards/redemptions.json`
- `test/features/rewards/mock_rewards_repository_test.dart`
- `test/features/rewards/rewards_screen_test.dart`
- `test/features/rewards/vouchers_screen_test.dart`

Modify `lib/app/providers/app_providers.dart`, `lib/core/mock/mock_seed_loader.dart`, `lib/core/mock/mock_scenario.dart`, `lib/app/router/app_router.dart`, `lib/features/wallet/data/mock_wallet_repository.dart`, `lib/core/presentation/app_copy.dart`, and `pubspec.yaml` (declare `assets/mock/rewards/`). Register `/rewards`, `/vouchers`, `/vouchers/:voucherId`. `redemptions.json` initially has an empty `items` array.

### Models: exact required fields

| Model / enum | Fields |
|---|---|
| `RewardCategory` | `id: String`, `label: String`, `sortOrder: int`; seed Food and Shopping. “All rewards” is the unfiltered UI choice, not a pretend backend category. |
| `Reward` | `id: String`, `title: String`, `description: String`, `merchantName: String`, `categoryId: String`, `tag: String?`, `imageUrl: String?`, `pointsCost: int`, `expiresAt: DateTime`, `isActive: bool`, `maxRedemptionsPerResident: int`, `residentRedemptionCount: int`, `artKey: String`, `sortOrder: int` |
| `RewardDocument` | Exactly the `Reward` fields above **except** computed `residentRedemptionCount`; define in `reward.dart`, with flat `fromMap`/`toMap`. |
| `VoucherStatus` | Wire values `available`, `used`, `expired`, `unknown`; unknown cannot be presented as redeemable. |
| `ResidentVoucher` | `id: String`, `residentId: String`, `rewardId: String?`, `title: String`, `merchantName: String`, `code: String`, `terms: String`, `issuedAt: DateTime`, `expiresAt: DateTime`, `status: VoucherStatus`, `remainingUses: int`, `usedAt: DateTime?`; reward ID is null for the seeded welcome voucher. |
| `RewardRedemption` | `id: String`, `residentId: String`, `rewardId: String`, `idempotencyKey: String`, `pointsSpent: int`, `redeemedAt: DateTime`, `voucherId: String`, `walletBalanceAfter: int`, `walletVersion: int`; flat persisted redemption. |
| `RewardRedemptionReceipt` | `redemption: RewardRedemption`, `voucher: ResidentVoucher`, `wallet: WalletSnapshot`; composed **response only**, defined in `reward_redemption.dart`, never a Firestore document. |

All implement `fromJson`/`toJson`; flat stored records additionally implement `fromMap`/`toMap`. Only receipt serialization may nest voucher/wallet data for tests/transport; its members are stored separately. `catalog.json` items are `RewardDocument` values; repositories enrich them with resident-scoped counts from flat redemption records. Seed `imageUrl: null` and use themed `artKey` placeholders; do not upload/fetch live Storage images. Seed one allowed redemption per resident per reward. Status/expiry checks use the injected clock.

### Repository interface and mock methods

The one-shot methods below on `RewardsRepository` return `Future<…>`; reactive counterparts following the table return `Stream`:

| Method contract | Result / mock behavior |
|---|---|
| `getCategories()` | `List<RewardCategory>` sorted by order. |
| `getRewards(categoryId: String?)` | `List<Reward>`; filter active, unexpired rewards by category; include current resident redemption count. |
| `getReward(rewardId: String)` | `Reward`; retrieve latest eligibility data before confirmation. |
| `redeemReward(rewardId: String, idempotencyKey: String)` | `RewardRedemptionReceipt`; atomically debit wallet, insert separate flat voucher/redemption records, update resident-scoped count and wallet version, then compose the receipt. Same key references the same redemption/voucher without another debit. |
| `getVouchers(status: VoucherStatus?)` | `List<ResidentVoucher>`; resident-owned, newest-first, with expiry evaluated consistently. |
| `getVoucher(voucherId: String)` | `ResidentVoucher`; missing/other-resident IDs produce not-found. |

Add exact reactive counterparts in that interface: `Stream<List<RewardCategory>> watchCategories();`, `Stream<List<Reward>> watchRewards({String? categoryId});`, `Stream<Reward?> watchReward(String rewardId);`, `Stream<List<ResidentVoucher>> watchVouchers({VoucherStatus? status});`, `Stream<ResidentVoucher?> watchVoucher(String voucherId);`. Displayed catalog/voucher data uses these in-memory live streams; async CRUD and delayed one-shot reads remain available. Count changes are projections from redemptions, not a per-user field written into a global reward document.

Keep wallet reward thresholds aligned with active/unexpired catalog prices. After this phase, `MockWalletRepository` can derive the next cost directly from the shared catalog; use Phase 3's configured costs only before the catalog dataset is installed. No screen recalculates catalog eligibility using a separate fake list.

### Interaction and local state

- Category chips are selectable and reflect `/rewards?category=<id>`; a fresh category selection reloads through the repository. Unknown IDs fall back to All and normalize the URL.
- Open confirmation for any eligible reward, displaying its latest cost/merchant and current balance. Cancel makes no change. Confirm has one stable idempotency key for that attempted redemption and preserves it across a retry.
- Show loading/failure/Retry without closing the dialog on failure. Enforce eligibility again in the repository, even if the button was previously enabled.
- Show insufficient points, redeemed limit, inactive, and expired states clearly; none can debit the wallet. Concurrent redemptions cannot make balance negative.
- On success, refresh/invalidate wallet, home wallet, catalog eligibility, voucher preview/list; show the source-style success banner and an Open voucher action.
- `My vouchers` preview resolves from `getVouchers`; View all opens the list, and a tile opens its detail. Detail shows merchant, code, terms, expiry, status, and remaining uses; Copy code uses Flutter Clipboard with success feedback.
- Voucher Available/Used/Expired tabs are typed filters, reflected in `/vouchers?status=…`. Do not consume a voucher just by opening/copying it; merchant redemption belongs to the later backend workflow.
- Seed one available welcome voucher; tests can inject used/expired vouchers to validate tabs. Keep the two-column reward visual where it fits; use one column if text scaling/narrow width requires it.

### Verification checklist

- [ ] All model JSON round-trips, expiry checks, category filtering, and unknown art/status fallbacks pass.
- [ ] Flat redemption/document maps contain string references, not embedded wallet/voucher/read-model data; reward maps omit resident-scoped counts, URL fields are strings/null, and catalog/voucher streams update from committed mutations without Firebase.
- [ ] From baseline 245, Vending snack costs 100, yields balance 145 and a new voucher; Welcome voucher remains present.
- [ ] After a baseline verified deposit, snack redemption gives 265 → 165; home and rewards agree without manual widget-local arithmetic.
- [ ] Every eligible card redeems, duplicate retries return the same voucher, failed writes roll back, and concurrent attempts cannot overspend.
- [ ] Zero balance, empty catalog, no vouchers, used/expired tabs, missing voucher ID, and read/mutation errors have actionable UI states.
- [ ] `flutter test test/features/rewards test/features/wallet` and common gate pass; list/detail routes open without passing an in-memory voucher in router `extra`.

---

## Phase 8 — Settings, editable account forms, notifications, and demo sign-out

**Prerequisite:** Phases 1–7. **Outcome:** Every resident Settings action has bounded functional behavior and saved local mock state.

### Source references

- `EcoLoop_AI_Figma_Design_Artifacts/src/App.tsx`: `ResidentSettings`, `rows`, `details`, `active` detail switching; `ResidentHome` name/avatar for cross-screen update checks.
- `EcoLoop_AI_Figma_Design_Artifacts/src/index.css`: `.profile`, `.settings-list`, `.avatar.large`, `.page-title`, shared buttons.
- Profile/password editing, preference switches, and the signed-out screen extend source placeholder actions. The Open admin demo control is omitted entirely.

### Exact target files

Create:

- `lib/features/account/domain/models/profile_update_request.dart`
- `lib/features/account/domain/models/account_security_info.dart`
- `lib/features/account/domain/models/password_change_request.dart`
- `lib/features/account/domain/models/notification_preferences.dart`
- `lib/features/account/domain/models/demo_session.dart`
- `lib/features/account/presentation/controllers/settings_controller.dart`
- `lib/features/account/presentation/controllers/profile_controller.dart`
- `lib/features/account/presentation/controllers/security_controller.dart`
- `lib/features/account/presentation/controllers/notification_preferences_controller.dart`
- `lib/features/account/presentation/controllers/demo_session_controller.dart`
- `lib/features/account/presentation/screens/settings_screen.dart`
- `lib/features/account/presentation/screens/profile_screen.dart`
- `lib/features/account/presentation/screens/security_screen.dart`
- `lib/features/account/presentation/screens/notification_preferences_screen.dart`
- `lib/features/account/presentation/screens/demo_session_screen.dart`
- `lib/features/account/presentation/widgets/settings_list_tile.dart`
- `assets/mock/account/security.json`
- `assets/mock/account/notification_preferences.json`
- `assets/mock/account/session.json`
- `test/features/account/mock_account_repository_test.dart`
- `test/features/account/settings_flow_test.dart`

Modify `lib/features/account/domain/repositories/account_repository.dart`, `lib/features/account/data/mock_account_repository.dart`, `lib/features/account/presentation/controllers/account_providers.dart`, `lib/app/providers/app_providers.dart`, `lib/core/mock/mock_seed_loader.dart`, `lib/app/router/app_router.dart`, `lib/core/presentation/app_copy.dart`, and `test/features/account/account_models_test.dart`. Register the Settings and signed-out routes listed in Phase 9.

### Models: exact required fields

| Model | Fields |
|---|---|
| `ProfileUpdateRequest` | `fullName: String`, `email: String`, `avatarUrl: String?`; retain current URL when editing name/email, with no live upload. |
| `AccountSecurityInfo` | `residentId: String`, `passwordUpdatedAt: DateTime`, `isProtected: bool` |
| `PasswordChangeRequest` | `currentPassword: String`, `newPassword: String`; transient request only, never stored in profile/security records or logs. Confirm-password is form-only state. |
| `NotificationPreferences` | `residentId: String`, `recyclingUpdates: bool`, `pointsCredits: bool`, `rewardReminders: bool`, `updatedAt: DateTime` |
| `DemoSession` | `id: String`, `residentId: String`, `isSignedIn: bool`, `startedAt: DateTime` |

All implement JSON serialization, including request models; credentials remain transient even though a future transport request can serialize them. `security.json` has a clearly fake `mockCurrentPassword` fixture value (`DemoPass123!`) alongside security metadata for deterministic validation; this extra fixture key is not part of `AccountSecurityInfo` or UI content. Initialize password age 30 days before the demo clock and preferences all enabled.

### AccountRepository additions and mock methods

The one-shot additions below return `Future<…>`; the separate watch additions following the table return `Stream`:

| Method contract | Result / mock behavior |
|---|---|
| `updateProfile(request: ProfileUpdateRequest)` | `ResidentProfile`; trim name/email, validate name and email, update canonical profile. |
| `getSecurityInfo()` | `AccountSecurityInfo`; used to compute password-age copy. |
| `changePassword(request: PasswordChangeRequest)` | `AccountSecurityInfo`; validate fake current password/new-password rule, update timestamp and transient mock credential state. |
| `getNotificationPreferences()` | `NotificationPreferences`; fetch saved switches. |
| `updateNotificationPreferences(preferences: NotificationPreferences)` | `NotificationPreferences`; save validated preferences with current mock timestamp. |
| `getDemoSession()` | `DemoSession`; asynchronously restore current local demo-session status. |
| `signOut()` | `void`; mark session signed out, clear active form/controller state, trigger routing refresh. |
| `resumeDemoSession()` | `DemoSession`; resume the same mock resident, retaining this process's saved data. |

Also declare `Stream<AccountSecurityInfo?> watchSecurityInfo();`, `Stream<NotificationPreferences?> watchNotificationPreferences();`, and `Stream<DemoSession> watchDemoSession();` in `AccountRepository`. Existing `getAuthState()`/`watchAuthState()` are authoritative: sign-out emits `{uid: null, role: null, isSignedIn: false}` and clears private observations; Continue demo emits `{uid: "RES-000842", role: AppRole.user, isSignedIn: true}` without initializing Firebase Auth. Keep account/profile/preference Future methods alongside the streams. Claim changes must refresh route guards even when the mock session ID does not change.

### Interaction and local state

- Settings shows actual profile data and three rows: Profile & personal details, Account security, Notifications. Sign out opens a confirmation. There is no admin action or resident/admin role-switch control; the read-only AuthState claim stream is separate from profile editing.
- Profile opens in view mode, Edit profile reveals a form; Save calls `updateProfile`, Cancel discards draft. Require a nonblank trimmed name and valid email; preserve `avatarUrl` in the request. Watch profile changes to update Home/Settings together. Email/password changes remain mock operations now; their future Firebase Auth account-update flow cannot be replaced by editing Firestore credentials.
- Security shows derived password age/protection status; Change password opens a form with current/new/confirm fields, visibility toggles, and a Save action. For this demo, require at least eight characters containing a letter and number; confirmation must match. Wrong current password shows a field error; no mutation occurs.
- Notifications shows three editable switches and an explicit Save action. Keep draft values on failure; Cancel restores the last saved preferences. Saving does not request OS push permissions or implement push delivery.
- Forms keep draft/dirty/submitting/error/success state separate from last saved data. Back with unsaved changes prompts discard/continue. Do not show success before a delayed write completes.
- Sign out disables repeat submission, awaits the mock call, and replaces the navigation stack with `/signed-out`. That screen clearly offers **Continue demo** via `resumeDemoSession`; it is not a fabricated production login form.
- Clear user-scoped cached presentation state on sign-out. On resume, re-read repositories; do not reseed or discard prior in-process wallet/history changes.

### Verification checklist

- [ ] New models round-trip JSON; profile trim/email validation, password validation, and all preference booleans are tested.
- [ ] Editing profile updates Home and Settings consistently. Cancel/discard and failed saves preserve the correct draft/saved values.
- [ ] Password errors show correctly; successful save changes the derived age; credentials are not rendered as profile content.
- [ ] Switch values survive route/tab changes after Save; failed preference writes can retry without losing the draft.
- [ ] Sign-out and Continue demo work; protected resident URLs redirect while signed out, and system Back cannot expose a cached resident screen.
- [ ] `flutter test test/features/account` and common gate pass; no admin entry point exists in any Settings state.

---

## Phase 9 — Centralized navigation, resident shell, and cross-feature state integration

**Prerequisite:** Phases 1–8. **Outcome:** All completed screens are connected through one authoritative router and the source-style resident shell.

### Source references

- `EcoLoop_AI_Figma_Design_Artifacts/src/App.tsx`: `ResidentApp`, page conditionals, top notification button, bottom nav, home quick links, scan Back to home, settings detail back behavior.
- `EcoLoop_AI_Figma_Design_Artifacts/src/index.css`: `.resident-shell`, `.mobile-top`, `.mobile-content`, `.bottom-nav`, `.scan-nav`, `.page-title`.
- The route table below replaces React's local `page` string/`active` string navigation.

### Exact target files

Create:

- `lib/app/router/route_parameter_parsers.dart`
- `lib/app/router/route_guards.dart`
- `lib/app/presentation/resident_shell.dart`
- `lib/app/presentation/resident_top_bar.dart`
- `lib/app/presentation/resident_bottom_navigation.dart`
- `lib/app/presentation/route_error_screen.dart`
- `test/app/app_router_test.dart`
- `test/app/resident_shell_test.dart`

Modify `lib/app/router/app_router.dart`, `lib/app/router/app_routes.dart`, `lib/app/eco_loop_app.dart`, `lib/app/providers/app_providers.dart`, `lib/app/bootstrap.dart`, and affected navigation callbacks/controllers. Retire the temporary bootstrap route; `bootstrap_screen.dart` can remain solely as the real startup/session-restoration loading screen, not a second home page.

### Required route table

Route names below are stable `AppRoutes` names. IDs are opaque nonempty strings decoded/validated centrally; do not split display text or use list indexes as IDs. Query parameters must survive direct links and browser refresh where data exists in seed/process memory.

| Path | Route name | Screen / parameters | Shell branch |
|---|---|---|---|
| `/` | `root` | Redirect after session restoration to `/home` or `/signed-out` | None |
| `/signed-out` | `signedOut` | `DemoSessionScreen`; no resident shell | None |
| `/home` | `home` | `HomeScreen` | Home |
| `/guide` | `guide` | `RecyclingGuideScreen` | Home |
| `/history` | `history` | `HistoryScreen`; optional `from`, `to`, `status` query keys; ISO calendar dates, inclusive `to` converted to exclusive filter boundary | Home |
| `/rewards` | `rewards` | `RewardsScreen`; optional `category` query key | Home |
| `/vouchers` | `vouchers` | `VouchersScreen`; optional `status` query key | Home |
| `/vouchers/:voucherId` | `voucherDetail` | `VoucherDetailScreen`; required `voucherId` | Home |
| `/scan` | `scan` | `ScanScreen`; starts/resumes through explicit controller policy | Scan |
| `/scan/sessions/:sessionId/bin` | `scanBin` | `ScanSessionScreen`; `sessionId`, expected `binFound` stage | Scan |
| `/scan/sessions/:sessionId/ready` | `scanReady` | Same screen; expected `ready` stage | Scan |
| `/scan/sessions/:sessionId/detected` | `scanDetected` | Same screen; expected `itemDetected` stage | Scan |
| `/scan/sessions/:sessionId/processing` | `scanProcessing` | Same screen; expected `processing` stage | Scan |
| `/scan/sessions/:sessionId/result` | `scanResult` | Same screen; expected `completed` stage, outcome read from repository | Scan |
| `/settings` | `settings` | `SettingsScreen` | Settings |
| `/settings/profile` | `profile` | `ProfileScreen` | Settings |
| `/settings/security` | `security` | `SecurityScreen` | Settings |
| `/settings/notifications` | `notificationPreferences` | `NotificationPreferencesScreen` | Settings |

These are **18 concrete route patterns** including `/` and `/signed-out`. Unknown paths use `GoRouter.errorBuilder`/`RouteErrorScreen`; do not add a misleading admin route or silently render Home for every unknown path.

### Router and shell implementation requirements

- Use `MaterialApp.router` and a single `GoRouter` provider. Use `StatefulShellRoute.indexedStack` for Home/Scan/Settings branches, with nested/associated routes assigned to the branches above. Assign a distinct navigator key to each branch.
- The bottom bar keeps the source's raised circular Scan affordance. Use a safe-area-aware shell: 78 logical pixels for bar content plus bottom inset, 72 for header content plus top inset. Avoid applying the CSS's 92-pixel bottom padding on top of Scaffold's already-reserved navigation space.
- The header and bottom bar remain visible across resident destinations as in the source. Dialogs/sheets appear on the root navigator above the shell.
- Home branch owns guide/history/rewards/vouchers even when directly linked. Settings descendants select Settings; all scan-stage routes select Scan. Index selection derives from branch/route location, never a second local page variable.
- Home/Scan/Settings taps use branch navigation with a documented reselect policy: reselect Home or Settings returns to that branch root; Scan resumes its in-process active session or starts at scanner if none/completed/cancelled. Starting a genuinely new session requires a new creation request ID.
- Push detail pages and use normal pop where an in-app parent exists. For cold-start guide/history/rewards/voucher links, provide deterministic fallback Back to Home or Vouchers as appropriate; settings detail Back goes to Settings.
- Handle Android/system Back, browser Back, top-left back, and bottom-branch switches consistently. Dirty forms and pre-processing scan cancellation use `PopScope`/appropriate router hooks. Branch changes also invoke the same dirty/cancel decision, rather than bypassing it.
- Initial mock auth observation begins once through `watchAuthState`, with `watchDemoSession` for mock session navigation only. While unresolved, show the bootstrap loading surface; on failure show retry. Require signed-in role `user`; a mocked `admin` claim must not unlock resident/admin-switch UI. Keep asynchronous reads out of redirect bodies; controllers resolve session existence/stage and guards consume resolved state without loops.
- A signed-out session redirects every resident path to `/signed-out`; Continue demo routes to Home with a fresh branch stack. No auth/backend server is required.
- Malformed query values are normalized to documented defaults; a malformed ID or missing resource shows recoverable not-found. Resolve voucher/session data by ID, not required `extra` objects; browser refresh must not fail merely because `extra` is absent.
- A direct link to a future/past scan stage resolves the session and redirects to its current canonical route. Result URLs cannot initiate verification; completed sessions cannot generate another credit.

### Models, mock methods, and invalidation map

No new serialized domain model is required. Use `AuthState`, `DemoSession`, `DepositSession`, `DepositFilter`, `RewardCategory`, and `VoucherStatus` for guards/parameter conversion. Guards observe `watchAuthState` and session/resource streams; existing delayed `getAuthState`, `getDemoSession`, `getSession`, `getResult`, and `getVoucher` remain one-shot lookups. UI-only route/controller state has no JSON contract. Snapshot delivery is the primary cross-feature refresh mechanism; the invalidation map below lists affected data and must not cause a second duplicate request beside a live subscription.

| Successful operation | Providers/data to refresh or invalidate |
|---|---|
| `completeVerification` | Current session, wallet, home dashboard, history queries, activity summary, bin snapshot, reward eligibility |
| `redeemReward` | Wallet/home wallet, rewards/catalog counts, voucher preview/list/detail |
| `updateProfile` | Account profile, Settings profile card, Home greeting/avatar |
| `changePassword` | Account security info only; clear password draft |
| `updateNotificationPreferences` | Saved preferences; replace dirty draft with returned values |
| `signOut` | Clear user-scoped presentation caches/branch stacks, refresh session-based router guard |
| `resumeDemoSession` | Session guard and all resident reads; canonical store stays intact |

### Verification checklist

- [ ] Every row in the route table opens through its intended entry point; direct links parse IDs/queries without an `extra` object.
- [ ] Three navigation branches highlight correctly, retain appropriate scroll/filter state, and follow documented reselect behavior.
- [ ] Header bell → history; Home guide/history/rewards/scan CTAs; voucher View all/detail; all settings rows and back actions work.
- [ ] Session-stage guards, malformed/unknown paths, signed-out redirects, startup retry, browser Back and system Back do not loop or expose stale screens.
- [ ] Dirty-form/cancel confirmations work for both Back and branch changes; processing can finish safely off-screen.
- [ ] Shared wallet/profile/history values remain coherent across all branches; no duplicated Scaffold header/bottom bar or inset padding exists.
- [ ] `flutter test test/app` and common gate pass; `flutter build web` verifies router compilation and direct-link-friendly ID resolution.

---

## Phase 10 — Resident journey acceptance, visual audit, and backend-ready handoff

**Prerequisite:** Phases 1–9. **Outcome:** The whole resident UI is usable and verified independently of backend development.

### Source references

- All resident symbols in `EcoLoop_AI_Figma_Design_Artifacts/src/App.tsx:3–193` and resident styling in `src/index.css:3–22`.
- Read `docs/ADMIN_PANEL_PAGES_AND_FILES.md` only to verify the resident/admin boundary, not as resident visual acceptance criteria.
- Compare against the fidelity decisions at the start of this plan; the computed wallet progress and functional extension screens intentionally differ from prototype shortcuts.

### Exact target files

Create:

- `integration_test/resident_journey_test.dart`
- `test/fixtures/mock_fixture_integrity_test.dart`
- `docs/FLUTTER_UI_ACCEPTANCE.md`
- `docs/FLUTTER_MOCK_CONTRACTS.md`

Modify `test/widget_test.dart`, `README.md`, and `docs/FLUTTER_UI_EXECUTION_LOG.md` with final launch/test/scenario instructions and actual results. Update existing implementation files only to fix failures found during this phase. No new production domain models or repository methods are expected.

### Required acceptance journeys

1. **Happy path:** start normal → Home (245) → guide → Home → scan every stage → verified result (2 pcs, +10 pts) → Home (255, 13 verified, 1.09 kg) → History sees the new verified record → Rewards → redeem snack (155) → new voucher detail → Settings → update name → Home reflects name.
2. **Review/rejection:** start a fresh overridden fixture for each outcome → complete scan → history displays actual outcome → wallet and verified impact remain unchanged.
3. **Recoverability:** fail a named read once → Retry; fail classification/redemption/profile save once → preserve state → Retry → exactly one committed result.
4. **Navigation:** direct link to voucher and settings detail; invalid/missing resource; Back from details; branch switching; unfinished scan cancellation; sign out → protected route blocked → Continue demo.
5. **Data boundaries:** empty deposits/rewards/vouchers, zero wallet, full/offline bin, expired/used voucher overrides, and long names/merchant labels.

### Fixture and UI audit

- Validate unique IDs, existing resident/reward/session references, coherent classifications, rate-derived earned points, wallet threshold/catalog agreement, opening impact totals, and date ordering/expiry against the injected clock.
- Compare Home, each of six scan visuals, guide, rewards, history, Settings and its three detail screens against the source at 390 and 480 widths; spot-check 320 and enlarged text. Verify documented extensions use the same design language.
- Use repository overrides/scenario providers in tests. Never add fake lists or direct store writes to production widgets to make a screenshot/test pass.
- Verify the mock app renders and completes its flow without network access after build. Font packages, remote image URLs, or startup service calls must not be hidden runtime dependencies.
- Inspect loading/error/empty states manually as well as the happy path. Avoid an arbitrary per-widget golden-test suite; prioritize the connected journey and meaningful state/transaction tests specified by the earlier phases.

### Final verification commands and checklist

Run from the existing repository root:

1. `flutter pub get`
2. `dart format --output=none --set-exit-if-changed lib test integration_test`
3. `flutter analyze`
4. `flutter test`
5. `flutter build web`
6. `flutter test integration_test/resident_journey_test.dart -d <available-device-id>`

Use `flutter devices` to choose the supported integration-test target; run the journey on an available emulator/device. If no target exists, record that exact limitation rather than claiming the integration test ran. For manual browser review, use `flutter run -d chrome --dart-define=MOCK_SCENARIO=normal`; select the other named scenarios the same way. Android/iOS runtime review should be performed where their tooling/device is available; iOS compilation is not an independent phase gate on this Windows workspace.

- [ ] All available checks pass; unavailable platform/device checks are explicitly recorded with a runnable command.
- [ ] Every original resident screen, every scan stage, and every settings detail is accounted for in `docs/FLUTTER_UI_ACCEPTANCE.md`.
- [ ] No dead tappable controls, widget-local dummy records, unhandled async errors, negative balances, duplicate credits, or embedded admin entry points remain.
- [ ] `docs/FLUTTER_MOCK_CONTRACTS.md` records actual model JSON shapes, enum wire values, fixture files, repository method signatures, latency/scenario controls, mutation/invalidation rules, and process-lifetime persistence.
- [ ] The handoff names the **same Firebase project** for Firestore/Auth/Storage/App Check and Firebase Hosting for admin deployment; it records the identical document paths, UID/custom-claim mapping, Timestamp converters, URL fields, stream/observable interfaces and unsubscribe behavior from both plans.
- [ ] Physical bin/AI events, Auth account updates, Storage uploads, merchant consumption, trusted Firestore atomic credit/redemption and real rules/indexes are deferred to Goals 3–4. Goals 1–2 contain no live Firebase initialization/calls, emulator connections or deployment.
- [ ] All three protected Android Firebase files match their pre-phase checksum baseline; no Gradle/Google Services rewrite was made to pass tests.
- [ ] `docs/FLUTTER_UI_EXECUTION_LOG.md` lists completed phases, commands/results, visual differences, and remaining integration work. It must not mark later admin/backend roadmap goals as implemented.

---

## Common gate for Phases 2–9

After each phase, format changed Dart files, run `flutter analyze`, run that phase's specified tests, and run `flutter test` to catch regressions. Recompare the three protected Android-file hashes against the original baseline and confirm no live Firebase initialization/SDK call, emulator connection or deployment was introduced. Build with `flutter build web` after structural/dependency/router changes. A phase is independently complete when its screen/contracts work with mock repositories/streams and the cumulative app compiles; full cross-feature route acceptance belongs to Phases 9–10.

## Execution handoff summary

| Phase | Deliverable | Primary correctness boundary |
|---|---|---|
| 1 | Bootstrap, dependency choices, extracted theme/assets | Buildable existing Flutter project; source visual tokens centralized |
| 2 | Shared controls, inputs, cards, dialogs, feedback | Reusable presentation without embedded domain/mock data |
| 3 | Typed account/wallet/activity and async mock store | JSON contracts, coherent canonical data, transactional writes |
| 4 | Home and history | Derived summaries, real filters, async states |
| 5 | Guide and rates | Repository-delivered learning content and consistent reward rules |
| 6 | Scan/deposit session flow | Valid transitions, idempotent credit/history mutation |
| 7 | Rewards and vouchers | Atomic nonnegative debit, all rewards functional, owned voucher access |
| 8 | Settings/account interactions | Validated forms, saved switches, mock session lifecycle |
| 9 | Final shell and go_router integration | Complete route/parameter/back/branch behavior and shared-state refresh |
| 10 | Connected acceptance and handoff | Verified resident UI ready for later backend replacement |

Execute in order. Preserve one source of truth for each dataset, one router for page navigation, and one theme for the Figma-derived visual system.
