# Goal 2 — Standalone EcoLoop Admin Website UI

- **Deliverable:** An execution plan, not an implemented website.
- **Executor:** Muse Spark 1.3 Contributor Free, or another agent executing one micro-phase at a time.
- **Project location:** `apps/admin-web/`, independent of the root Flutter package and the Figma artifact.
- **Stack:** React + TypeScript + Vite; mock services only for this goal.
- **Contract authority:** `docs/FIGMA_USER_APP_TO_FLUTTER_IMPLEMENTATION_PLAN.md`.
- **Backend alignment revision:** Firestore/Auth/Storage/App Check in one Firebase project, with Firebase Hosting for admin deployment in Goals 3–4; Goals 1–2 remain mock-only.
- **Phase allocation confirmed by the user:** Exactly **10 phases**, pairing the six actual admin screens in phases 7–9. Each phase has **3–5 explicitly listed target files**, including modified files and the generated dependency lockfile.

## Read this before executing any phase

### The source trace and actual scope

The real entry chain is:

1. `EcoLoop_AI_Figma_Design_Artifacts/src/main.tsx` mounts `src/App.tsx` and imports `src/index.css`.
2. Root `App` at `src/App.tsx:264–268` chooses `ResidentApp` or `AdminApp` using a local `role` variable and shares one `capacity` variable.
3. `ResidentApp` at `src/App.tsx:54–84` passes `switchRole` into `ResidentSettings`.
4. `ResidentSettings` at `src/App.tsx:164–193` renders “Open admin demo”; clicking it changes `role` to `admin`.
5. `AdminApp` at `src/App.tsx:197–215` renders sidebar/header and the six pages from `adminNav` at line 195.
6. Those pages are `Overview`, `Bins`/`BinTable`, `Alerts`, `Verification`, `AdminVouchers`, and `AdminSettings`, all in the same `App.tsx`.
7. Icons/buttons/badges/brand are also inline in `App.tsx:3–46`; admin styling is mainly `src/index.css:23–28`, with shared tokens/styles at lines 3–16.

`docs/ADMIN_PANEL_PAGES_AND_FILES.md` is useful context, but it overstates some implemented behavior: the actual voucher creation panel has no input fields and simply inserts a fixed row; Edit mostly exposes an active/draft toggle. Search and several review-selection controls are also inert. This plan makes those controls functional and keeps the **six actual screens**, rather than inventing a user-management or logs page from generic admin examples.

There are **no component files, API modules, image exports, or auth provider hidden behind this button**. Do not invent imports from a nonexistent Figma `components/` tree. The generic `public/favicon.svg` is not an EcoLoop brand asset.

### Independent application boundary & Strict Scope Rules

- **Allowed Scope (Whitelist):**
  - All web application code, assets, and tests MUST live strictly under `apps/admin-web/`.
  - Development logs must be written to `docs/dev_logs/` (following the naming convention `YYYY-MM-DD_AdminWeb_Phase<N>*.md`).
  - Acceptance documentation must be written to `docs/ADMIN_WEB_ACCEPTANCE.md` (Phase 10).
- **Forbidden Scope (Strictly Off-Limits):**
  - **NEVER create, modify, move, rename, or delete ANY file or directory outside `apps/admin-web/`**, with the sole exception of the designated log/acceptance files in `docs/` mentioned above.
  - Specifically, **DO NOT TOUCH**:
    - Flutter codebase (`lib/`, `test/`, `assets/`, `web/`)
    - Native mobile platform directories (`android/`, `ios/`)
    - Flutter project manifests and toolchain configs (`pubspec.yaml`, `pubspec.lock`, `analysis_options.yaml`, `.metadata`)
    - Flutter agent configurations (`.agent/developer/agent.md`, `.agent/tester/agent.md`)
    - The Figma design artifacts (`EcoLoop_AI_Figma_Design_Artifacts/` is **strictly READ-ONLY**)
    - Existing Flutter plans (`docs/FIGMA_USER_APP_TO_FLUTTER_IMPLEMENTATION_PLAN.md` is **strictly READ-ONLY** contract authority)
- **Zero Deletions Outside Scope:** Under no circumstances may the Web Developer or agent delete files created by other agents, developers, or sessions.
- Replace the resident role-switch dependency with `/login` and an admin-only mock session. Remove the source's “Resident app”/role-switch buttons from the copied shell.
- Admin and Flutter will use **the same Firebase project**, Auth UIDs/role claims, Firestore documents and Storage URL conventions in Goals 3–4. Their stateful in-memory stores are **separate processes** in Goals 1–2; changing one mock app does not change the other.
- Do not add a backend, database, actual API endpoint, real authentication, or browser-storage synchronization in this goal.
- Source line numbers are aids; locate the named functions if lines change.

### Required Firebase architecture — contract now, SDKs later

| Goal 3 / Goal 4 service | Required behavior | Goal 1 / Goal 2 boundary |
|---|---|---|
| **Cloud Firestore** | Shared NoSQL collections/documents, string document IDs and snapshot-based reads | Stateful in-memory documents/observable snapshots only; no SDK, remote or emulator calls |
| **Firebase Auth** | Shared UID identity and trusted custom claim `role: "user" \| "admin"`; admin UI requires `admin` | Mock UID/claims/auth streams; no real sign-in/token calls |
| **Firebase Cloud Storage** | Uploads eventually return HTTPS download URL strings stored in document URL fields | Null/mock URL values and placeholders only; no real upload/download SDK calls |
| **Firebase App Check** | Future integrated clients use App Check for applicable Firebase resources | No initialization, attestation, provider registration or real/debug token requests |
| **Firebase Hosting** | Deploy `apps/admin-web/dist` with SPA rewrite to `/index.html` in Goal 4 | Local Vite preview/build only; no Firebase CLI project selection, init/config generation or deploy |

**CRITICAL: Goals 1 and 2 MUST STILL use stateful in-memory MockRepositories with simulated async delays. DO NOT initialize or call live Firebase SDKs.** Do not install/import `firebase`, `firebase-admin`, FlutterFire runtime packages or RxJS to execute this plan; the exact Phase 1 dependencies remain sufficient. Do not call `initializeApp`, `getAuth`, `getFirestore`, `getStorage`, `initializeAppCheck`, connect to emulators, run `flutterfire configure`/`firebase init`/`firebase deploy`, or create `.firebaserc`, `firebase.json`, live environment credentials or service-account files. Firebase adapters, Auth/rules/indexes/App Check and Hosting deployment are Goal 3–4 work.

Existing user-owned Flutter Firebase setup is not an admin target. **DO NOT OVERWRITE OR MODIFY** `android/build.gradle.kts`, `android/app/build.gradle.kts`, or `android/app/google-services.json`; do not reset native config while scaffolding this standalone website.

No Firebase project ID, bucket name or web app configuration is supplied here. Do not invent values, create/select another project or copy configuration from a tutorial; authorized Goal 3–4 integration reuses the user's existing Firebase project.

### Shared Firestore document contract — identical in both plans

- `ResidentProfile.id` equals its Firebase Auth UID and `residents/{uid}` document ID; `AdminIdentity.id` equals its Auth UID and `adminProfiles/{uid}` document ID. `residentId`, `adminId`, and `reviewedByAdminId` store those same UID strings. `RES-000842`, `RES-000843`, and `ADM-001` are **mock UID strings**, not a separate production identity scheme.
- `AuthState` is exactly `{ uid: string | null; role: AppRole | null; isSignedIn: boolean }`; `AppRole` is `user | admin`. Signed-out state is null/null/false; signed-in state requires nonblank UID and recognized role. Roles are mocked claims now and Firebase Auth custom claims later, never writable profile fields. `DemoSession`/`AdminSession` are mock session DTOs, not Firestore records or token stores.
- All stored records are flat scalars/nullable scalars/scalar arrays with string references. Store session `resultId`, not an embedded result; store redemption `voucherId`, `walletBalanceAfter`, `walletVersion`, not embedded wallet/voucher objects. No SQL auto-increment keys, SQL foreign-key integers, `DocumentReference` instances, dates formatted for display, or undefined properties.
- `RewardRedemptionReceipt`, `RecyclingGuide`, `AdminSettings`, joined rows, snapshots and dashboard summaries are composed **read responses**. Do not persist them wholesale. Credentials, filters and AuthState are transient; passwords never go into Firestore.

| Future collection/document path | Flat record and exact ID rule |
|---|---|
| `residents/{uid}` | `ResidentProfile`; `id == uid`, nullable `avatarUrl: string | null` |
| `wallets/{uid}` | `WalletDocument`: `residentId: string`, `balance: number` (integer), `updatedAt: ISODateTime`, `version: number` (integer); computed `nextRewardCost` exists only in `WalletSnapshot` |
| `deposits/{id}` | `DepositTransaction`; `id == document ID`, owner `residentId == Auth UID` |
| `bins/{id}` | `SmartBin`; `id == document ID` |
| `depositSessions/{id}` / `depositResults/{id}` | Flat `DepositSession` / `DepositResult`; nullable `resultId` references a result document |
| `rewardCategories/{id}` | `RewardCategory` |
| `rewards/{id}` | `RewardDocument`: `Reward` fields except computed `residentRedemptionCount`, including nullable `imageUrl: string | null` |
| `residentVouchers/{id}` / `rewardRedemptions/{id}` | Flat `ResidentVoucher` / `RewardRedemption`; owner `residentId` is a UID, `voucherId` is a document reference string |
| `guideContent/{id}` | `RecyclingGuideContent`: `id`, `heroTitle`, `heroDescription`, `toDo: string[]`, `toAvoid: string[]`, `pointsDisclaimer`; default ID `guide-default` |
| `guideMaterials/{id}` / `guideSteps/{id}` | `RecyclingMaterial` / `RecyclingStep`; repository composes guide lists |
| `materialRates/{materialType}` | `MaterialRate`; document ID is the exact material enum string |
| `scanInstructions/default` | `ScanInstructions` with `id: string` equal to `default` |
| `notificationPreferences/{uid}` / `accountSecurity/{uid}` | Preferences/security metadata; `residentId == uid`; no credentials |
| `adminProfiles/{uid}` / `binOperations/{binId}` | `AdminIdentity` / `BinOperations`; embedded ID matches document key |
| `capacityAlerts/{id}` / `verificationTickets/{id}` | Flat admin-only records, including nullable Storage `captureImageUrl` on tickets |
| `programSettings/global` | `ProgramSettingsDocument`: `id: "global"`, `capacityAlertThreshold: 75 | 80 | 85`, `acceptedMaterials: MaterialType[]`, `updatedAt: ISODateTime`; rates live separately in `materialRates` |

Firestore-specific Timestamp conversion belongs to adapters in Goals 3–4. Goals 1–2 accept ISO/native-date/SDK-free `{seconds, nanoseconds}` inputs in codecs, normalize declared instant fields to UTC ISO millisecond precision, and emit ISO map values; future adapters translate them to/from real Firestore `Timestamp`/server timestamps. Never infer dates from every string or convert `DailyActivity.date` calendar labels into instants.

`ResidentProfile.avatarUrl`, `Reward.imageUrl`, and `VerificationTicket.captureImageUrl` are nullable **HTTPS download URL strings**. Null selects local placeholders; no `File`, Blob, base64, bytes, upload task, StorageReference or `gs://` value belongs in these fields. Future Storage repository adapters return strings; UI goals do not upload or fetch Firebase media.

### Small-context execution protocol

1. Read this preamble, the current phase, and only the prerequisite contract files named by that phase.
2. Inspect the current target files before changing them. Preserve unrelated existing work.
3. Import only exports explicitly declared in this document or verified in a file already created.
4. Complete one screen in a paired phase and run its checks before opening the second screen's source. The pair shares one file budget, not one large copy/paste implementation task.
5. Run the phase gate. If a required fix is outside its target list, stop and report the exact file and failure; do not silently expand the phase.
6. Do not create helper/barrel/config files outside the listed targets. Dependencies are installed once in Phase 1.
7. `node_modules/`, `dist/`, browser binaries and test reports are tool-generated outputs, not source-file targets. The generated `package-lock.json` **is** counted as a Phase 1 target.
8. Call React hooks unconditionally before loading/error early returns. Conditional resource reads belong in a private child component mounted only when its required ID is known, not in a conditionally called hook.
9. Copy interface/type/seed/config blocks as written. Function/class signature blocks define the exact public API: implement their bodies and variable initializers in the assigned file; do not paste bodyless declarations into runtime `.ts`/`.tsx` modules or invent additional exports.
10. The Firebase/mock-only boundary and protected Android files above apply in **every** phase. Do not add Firebase config/SDK files to a target list, increase a phase past five files, rename shared contracts, or invent observable props not declared below.
11. Commit each completed phase before beginning the next one. If a request spans
    multiple phases, preserve separate phase commits when file boundaries allow
    it and place only inseparable integration in a final commit. Commit every
    request and code/documentation edit unless the moderator explicitly says not
    to commit or manually stops the process.

### Final file map and per-phase budget

All paths in target lists are repository-relative. Inside `apps/admin-web/`, imports use explicit relative `.ts`/`.tsx` paths, never `@/` aliases.

| Phase | Bounded deliverable | Files touched |
|---|---|---:|
| 1 | Package, lockfile, HTML entry, React entry, theme | 5 |
| 2 | Shared contracts, admin contracts, JSON codecs, contract tests, ignore file | 5 |
| 3 | Repository interfaces, seeds, stateful mocks, app services/hooks, tests | 5 |
| 4 | Primitive components, modal components, component CSS, theme refinement, entry preview | 5 |
| 5 | Generic table, filter/pagination controls, table CSS, entry preview | 4 |
| 6 | Router, shell, login, shell CSS, entry wiring | 5 |
| 7 | Overview + Smart Bins, fleet CSS, route registration | 4 |
| 8 | Capacity Alerts + Deposit Verification, operations CSS, route registration | 4 |
| 9 | Rewards & Vouchers + Settings, program CSS, route registration | 4 |
| 10 | Shared-state final checks, table final checks, E2E test/config, acceptance record | 5 |

The final feature folders are `features/fleet/`, `features/operations/`, and `features/program/`. Each contains two independently routed screen files and one feature stylesheet. Shared contracts/repositories live outside feature presentation so their names do not drift.

### Cross-client invariants — never rename these

| Meaning | Required field/wire value | Forbidden substitute |
|---|---|---|
| Reward title and cost | `Reward.title`, `Reward.pointsCost` | Figma `name`, `points`, `cost` in persisted records |
| Reward publication | `Reward.isActive: boolean` | `Reward.status: "Active" \| "Draft"` |
| Issued resident voucher lifecycle | `ResidentVoucher.status: available/used/expired/unknown` | Mixing catalog Draft/Active into `VoucherStatus` |
| Bin fill level | `SmartBin.capacityPercent: number` | `capacity`, `fillLevel`, formatted `"85%"` |
| Metal material | `aluminium` | `metal`, `Metal`, `Aluminium` as enum values |
| Deposit moderation outcome | `DepositTransaction.status: verified/review/rejected/unknown` | Persisting `Approved` or `Awaiting review` in that field |
| Rewarded quantity | `pointsAwarded: number \| null`, `itemCount: number` | `"+10"`, `"Pending"`, `"2 pcs"` |
| Resident identity | `ResidentProfile.fullName`, `email` | Invented `firstName`, `avatarInitials`, `username` fields |

Additional admin-only records are explicitly defined in Phase 2. They reference shared IDs; they do not add fields to, extend, or replace the shared resident interfaces.

### Fixed mock clock and intentional prototype corrections

Use `2024-05-20T11:00:00+08:00` as the injected mock clock, matching the resident plan. Use May–July 2024 expiries and `en-MY` presentation with `Asia/Kuala_Lumpur`; do not compare fixtures with the host's 2026 clock.

Actual mock-derived totals replace Figma's disconnected illustrative 24/1,284/18,450/328 figures. Preserve the chart/card layout, but derive counts and chart series from seeded records. Capacity color bands remain normal `<60`, warning `60–79`, critical `>=80`; the **alert-trigger threshold** is a separate configurable 75/80/85 value, as in the source.

---

## Phase 1 — Standalone project and centralized theme

### 1. Scope & Objective

Create an independently runnable web package with pinned dependencies and a minimal React entry. Extract Figma styling into one theme stylesheet without importing resident code or implementing admin features.

### 2. Source Figma Make Files (Read-Only Reference)

- `EcoLoop_AI_Figma_Design_Artifacts/package.json`: stack only; do not copy Figma plugins.
- `EcoLoop_AI_Figma_Design_Artifacts/src/main.tsx`: mount/CSS wiring.
- `EcoLoop_AI_Figma_Design_Artifacts/src/App.tsx`: `Brand`, `AdminApp`, `AdminTitle`.
- `EcoLoop_AI_Figma_Design_Artifacts/src/index.css`: `:root`, shared rules, `.admin-shell`, responsive breakpoints.

### 3. Target Files to Create or Modify

**Exactly 5 targets; all create:**

1. `apps/admin-web/package.json`
2. `apps/admin-web/package-lock.json` — generated by `npm install`.
3. `apps/admin-web/index.html`
4. `apps/admin-web/src/main.tsx`
5. `apps/admin-web/src/theme.css`

Create parent directories as needed. Empty directories do not require placeholder files.

### 4. Explicit Contracts & Signatures

Planned final folder structure is below; create files only in their assigned phase, not all at scaffold time:

```text
apps/admin-web/
  package.json
  package-lock.json
  index.html
  .gitignore
  playwright.config.ts
  src/
    main.tsx
    theme.css
    contracts/{shared.ts,admin.ts,codecs.ts}
    data/{repositories.ts,mockSeeds.ts,mockRepositories.ts}
    app/{services.ts,router.tsx,AdminShell.tsx,LoginPage.tsx,shell.css}
    ui/{primitives.tsx,Modal.tsx,primitives.css,DataTable.tsx,ListControls.tsx,data-table.css}
    features/
      fleet/{OverviewPage.tsx,SmartBinsPage.tsx,fleet.css}
      operations/{CapacityAlertsPage.tsx,DepositVerificationPage.tsx,operations.css}
      program/{RewardsVouchersPage.tsx,SettingsPage.tsx,program.css}
  tests/{contracts.test.ts,admin.e2e.spec.ts}
docs/ADMIN_WEB_ACCEPTANCE.md
```

Use Node **22.14.0** and npm **10.9.2** as the reproducible reference toolchain. Dependency versions below are exact published versions; availability was checked against npm metadata when preparing the plan, but installation/build verification belongs to the executing agent.

Copy this package manifest; no version ranges:

```json
{
  "name": "ecoloop-admin-web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22.14.0 <23", "npm": ">=10.9.2 <11" },
  "scripts": {
    "dev": "vite --host 127.0.0.1 --port 5174 --strictPort",
    "preview": "vite preview --host 127.0.0.1 --port 4174 --strictPort",
    "check": "tsc --noEmit --strict --noUnusedLocals --noUnusedParameters --target ES2022 --module ESNext --moduleResolution Bundler --jsx react --lib ES2022,DOM,DOM.Iterable --skipLibCheck --allowImportingTsExtensions",
    "lint": "npm run check -- src/main.tsx",
    "check:tests": "npm run check -- tests/contracts.test.ts",
    "build": "vite build",
    "test": "node --experimental-strip-types --test tests/contracts.test.ts",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "@fontsource/inter": "5.2.5",
    "react": "19.0.0",
    "react-dom": "19.0.0",
    "react-router-dom": "7.6.2",
    "zod": "3.24.2"
  },
  "devDependencies": {
    "@playwright/test": "1.51.1",
    "@types/node": "22.14.0",
    "@types/react": "19.0.0",
    "@types/react-dom": "19.0.0",
    "typescript": "5.7.3",
    "vite": "8.0.5"
  }
}
```

`lint` means strict TypeScript/unused-symbol static checks here, **not ESLint**. The explicit compiler options avoid additional config files; do not add a guessed `tsconfig.json` or Vite plugin. Vite provides the TSX transform; use `import * as React from "react"` and `React.ReactElement` return types in all `.tsx` modules so classic JSX has a real React binding.

`index.html` must contain one `div#root`, viewport metadata, title `EcoLoop AI Admin`, and module script `/src/main.tsx`. The initial `main.tsx` exports `BootstrapPreview(): React.ReactElement` and mounts it with `createRoot`; it imports `./theme.css` and `@fontsource/inter/400.css`, `600.css`, `700.css`, `800.css`. Do not mount `StrictMode` during these deterministic failure-once mock demos; do not add business records to the preview.

Define these exact CSS custom properties in `theme.css`:

```css
:root {
  --green: #176b45; --green-dark: #0f5235;
  --sage: #ddebdd;
  --mint: #edf5ee; --bg: #f8faf6; --surface: #ffffff;
  --text: #202820; --muted: #687268; --line: #e2e8e0;
  --amber: #f2b544; --amber-bg: #fff7e5; --amber-text: #875b06;
  --red: #d9534f; --red-bg: #fff0ef; --red-text: #a23632;
  --gray-bg: #f0f2ef; --gray-text: #626a62; --blue: #477c91;
  --sidebar: #102e21; --sidebar-brand: #2b805a;
  --sidebar-accent: #75c49a; --sidebar-text: #b9cec2;
  --sidebar-muted: #91ab9c; --scanner: #16251d;
  --radius: 16px; --radius-control: 12px;
  --shadow: 0 8px 28px rgb(24 52 35 / 8%);
  --sidebar-width: 244px; --sidebar-collapsed-width: 78px;
  --header-height: 72px; --content-max: 1440px;
  --space-1: 4px; --space-2: 8px; --space-3: 12px;
  --space-4: 16px; --space-5: 20px; --space-6: 22px;
  --space-7: 24px; --space-8: 28px; --space-9: 32px;
}
```

Use Inter/system fallback, h1 28px admin/24px mobile, h2 19px, h3 15px, body 14px, table 12px, eyebrow 11px/800/.11em. Breakpoints: full sidebar above 900px; compact rail 700–900px; off-canvas drawer below 700px. This phase only defines the theme and a centered branded bootstrap; shell geometry is implemented in Phase 6.

No domain models or repositories are introduced in this phase.

### 5. Anti-Hallucination Guardrails ("DO NOT" Rules)

- Do NOT initialize/call Firebase, install Firebase SDKs, generate Firebase/App Check/Hosting config, or edit the three protected Android files; use only the mock-only scaffold/dependencies listed here.
- Do NOT run `npm create vite`; it would create unbudgeted files and choose unpinned dependencies.
- Do NOT copy Tailwind imports, Figma plugins, React resident components, or the root Flutter `web/` folder.
- Do NOT add Axios, TanStack Query, Redux, chart/table libraries, icon libraries, or auth packages.
- Do NOT create any file outside the five targets, including a README/config/barrel file.
- Do NOT run `check:tests`/`test` before their test target exists in Phase 2.

### 6. Step-by-Step Verification Gate

Use the terminal's working-directory option `apps/admin-web` for every command below; do not chain commands with PowerShell `&&`.

1. Check `node --version` and `npm --version` against the reference toolchain; report an incompatible version before installing.
2. Run `npm install`, then `npm ls --depth=0`; verify the exact top-level versions above and generated lockfile.
3. Run `npm run lint` and `npm run build` separately; both must pass.
4. Run `npm run dev`; open `http://127.0.0.1:5174`.
5. Verify Inter, green EcoLoop title, background/surface tokens, and no resident phone frame. Check 390px and 1440px widths and confirm the browser console has no missing module errors.
6. Confirm only the five target source/lock files were created; build/dependency outputs are not part of the deliverable.
7. Verify `npm ls --depth=0` still matches the exact manifest, no Firebase SDK/config files were introduced, and the browser makes no Firebase/App Check/Storage requests.

---

## Phase 2 — Complete shared and admin contracts, with JSON validation

### 1. Scope & Objective

Create the complete TypeScript wire-model mirror of the resident plan plus explicitly separate admin-only records. Add typed JSON codecs and contract tests so the executor cannot substitute Figma field names or silently invent properties.

### 2. Source Figma Make Files (Read-Only Reference)

- `EcoLoop_AI_Figma_Design_Artifacts/src/App.tsx`: `transactions`, `ScanFlow`, `Rewards`, `ResidentSettings`, `BinTable`, `Verification`, `AdminVouchers`, `AdminSettings`.
- `EcoLoop_AI_Figma_Design_Artifacts/src/index.css`: status labels/tones only, not storage schemas.
- Additional contract reference: resident plan Phases 3, 5, 6, 7, 8. This document writes out the required fields below so no guessing is needed.

### 3. Target Files to Create or Modify

**Exactly 5 targets; all create:**

1. `apps/admin-web/src/contracts/shared.ts`
2. `apps/admin-web/src/contracts/admin.ts`
3. `apps/admin-web/src/contracts/codecs.ts`
4. `apps/admin-web/tests/contracts.test.ts`
5. `apps/admin-web/.gitignore`

### 4. Explicit Contracts & Signatures

#### A. Shared TypeScript/Dart alignment

These are SDK-free JSON transport interfaces, so Dart `DateTime` is represented by an ISO string rather than a JavaScript `Date`/Firestore Timestamp. Model names, field names, nullability and enum wire values match the revised resident plan 1:1; the separate document registry below prevents nested read responses or computed fields being written to Firestore.

| Dart domain type | TypeScript JSON type | Rule |
|---|---|---|
| `String` | `string` | Same exact field name |
| `int` | `number` | Runtime integer validation |
| `double` | `number` | Finite numeric value, not formatted text |
| `bool` | `boolean` | Not `0/1` or a status string |
| `DateTime` | `ISODateTime` | Offset/UTC ISO-8601; Dart `fromJson` parses it, `toJson` serializes it |
| `T?` | `T \| null` | Required key containing null, not an optional property |
| `List<T>` | `T[]` | JSON array, recursively decoded |
| Dart enum | String union below | Wire values exactly match; display labels are separate |

Create **all** declarations below in `shared.ts`. They are contracts, not instructions to build unused resident screens on the admin site.

```ts
export type ISODateTime = string;
export type AppRole = "user" | "admin";
export type MaterialType = "plastic" | "aluminium" | "paper" | "glass" | "unknown";
export type DepositStatus = "verified" | "review" | "rejected" | "unknown";
export type ScanStage = "binFound" | "ready" | "itemDetected" | "processing" | "completed" | "cancelled";
export type DepositOutcome = "verified" | "review" | "rejected" | "unknown";
export type VoucherStatus = "available" | "used" | "expired" | "unknown";

export interface AuthState {
  uid: string | null; role: AppRole | null; isSignedIn: boolean;
}
export interface ResidentProfile {
  id: string; fullName: string; email: string; avatarUrl: string | null; createdAt: ISODateTime;
}
export interface WalletDocument {
  residentId: string; balance: number; updatedAt: ISODateTime; version: number;
}
export interface WalletSnapshot {
  residentId: string; balance: number; nextRewardCost: number | null;
  updatedAt: ISODateTime; version: number;
}
export interface DepositTransaction {
  id: string; residentId: string; sessionId: string | null;
  binId: string; binLocation: string; materialType: MaterialType;
  materialLabel: string; itemCount: number; pointsAwarded: number | null;
  status: DepositStatus; occurredAt: ISODateTime; verifiedAt: ISODateTime | null;
}
export interface DepositFilter {
  from: ISODateTime | null; toExclusive: ISODateTime | null;
  status: DepositStatus | null;
}
export interface RecyclingSummary {
  verifiedDepositCount: number; verifiedWeightKg: number;
}
export interface RecyclingMaterial {
  id: string; type: MaterialType; title: string;
  preparationTip: string; iconKey: string; sortOrder: number;
}
export interface RecyclingStep {
  id: string; order: number; instruction: string;
}
export interface MaterialRate {
  materialType: MaterialType; displayName: string; pointsPerItem: number;
  eligible: boolean;
}
export interface RecyclingGuide {
  id: string; heroTitle: string; heroDescription: string;
  materials: RecyclingMaterial[]; toDo: string[]; toAvoid: string[];
  steps: RecyclingStep[]; rates: MaterialRate[]; pointsDisclaimer: string;
}
export interface RecyclingGuideContent {
  id: string; heroTitle: string; heroDescription: string;
  toDo: string[]; toAvoid: string[]; pointsDisclaimer: string;
}
export interface SmartBin {
  id: string; locationName: string; locationDetail: string;
  capacityPercent: number; acceptedMaterials: MaterialType[];
  isOnline: boolean; lastUpdatedAt: ISODateTime;
}
export interface ScanInstructions {
  id: string; scannerTitle: string; scannerDescription: string; binFoundTitle: string;
  readyTitle: string; readyDescription: string; itemDetectedTitle: string;
  itemDetectedDescription: string; processingTitle: string;
  processingDescription: string; verifiedTitle: string; reviewTitle: string;
  rejectedTitle: string; pointsTimingNotice: string;
}
export interface DepositSession {
  id: string; residentId: string; binId: string; stage: ScanStage;
  createdAt: ISODateTime; updatedAt: ISODateTime;
  creationRequestId: string; resultId: string | null;
}
export interface DepositResult {
  id: string; sessionId: string; transactionId: string;
  outcome: DepositOutcome; materialType: MaterialType; materialLabel: string;
  itemCount: number; pointsAwarded: number | null;
  classifiedAt: ISODateTime; explanation: string;
}
export interface RewardCategory {
  id: string; label: string; sortOrder: number;
}
export interface Reward {
  id: string; title: string; description: string; merchantName: string;
  categoryId: string; tag: string | null; imageUrl: string | null; pointsCost: number;
  expiresAt: ISODateTime; isActive: boolean;
  maxRedemptionsPerResident: number; residentRedemptionCount: number;
  artKey: string; sortOrder: number;
}
export type RewardDocument = Omit<Reward, "residentRedemptionCount">;
export interface ResidentVoucher {
  id: string; residentId: string; rewardId: string | null; title: string;
  merchantName: string; code: string; terms: string;
  issuedAt: ISODateTime; expiresAt: ISODateTime; status: VoucherStatus;
  remainingUses: number; usedAt: ISODateTime | null;
}
export interface RewardRedemption {
  id: string; residentId: string; rewardId: string; idempotencyKey: string;
  pointsSpent: number; redeemedAt: ISODateTime;
  voucherId: string; walletBalanceAfter: number; walletVersion: number;
}
export interface RewardRedemptionReceipt {
  redemption: RewardRedemption;
  voucher: ResidentVoucher; wallet: WalletSnapshot;
}
export interface ProfileUpdateRequest { fullName: string; email: string; avatarUrl: string | null; }
export interface AccountSecurityInfo {
  residentId: string; passwordUpdatedAt: ISODateTime; isProtected: boolean;
}
export interface PasswordChangeRequest { currentPassword: string; newPassword: string; }
export interface NotificationPreferences {
  residentId: string; recyclingUpdates: boolean; pointsCredits: boolean;
  rewardReminders: boolean; updatedAt: ISODateTime;
}
export interface DemoSession {
  id: string; residentId: string; isSignedIn: boolean; startedAt: ISODateTime;
}

export interface SharedRecords {
  AuthState: AuthState;
  ResidentProfile: ResidentProfile;
  WalletDocument: WalletDocument;
  WalletSnapshot: WalletSnapshot;
  DepositTransaction: DepositTransaction;
  DepositFilter: DepositFilter;
  RecyclingSummary: RecyclingSummary;
  RecyclingMaterial: RecyclingMaterial;
  RecyclingStep: RecyclingStep;
  MaterialRate: MaterialRate;
  RecyclingGuide: RecyclingGuide;
  RecyclingGuideContent: RecyclingGuideContent;
  SmartBin: SmartBin;
  ScanInstructions: ScanInstructions;
  DepositSession: DepositSession;
  DepositResult: DepositResult;
  RewardCategory: RewardCategory;
  Reward: Reward;
  RewardDocument: RewardDocument;
  ResidentVoucher: ResidentVoucher;
  RewardRedemption: RewardRedemption;
  RewardRedemptionReceipt: RewardRedemptionReceipt;
  ProfileUpdateRequest: ProfileUpdateRequest;
  AccountSecurityInfo: AccountSecurityInfo;
  PasswordChangeRequest: PasswordChangeRequest;
  NotificationPreferences: NotificationPreferences;
  DemoSession: DemoSession;
}

export type SharedDocumentRecords = Pick<SharedRecords,
  "ResidentProfile" | "WalletDocument" | "DepositTransaction" |
  "RecyclingMaterial" | "RecyclingStep" | "MaterialRate" | "RecyclingGuideContent" |
  "SmartBin" | "ScanInstructions" | "DepositSession" | "DepositResult" |
  "RewardCategory" | "RewardDocument" | "ResidentVoucher" | "RewardRedemption" |
  "AccountSecurityInfo" | "NotificationPreferences">;
```

Dart classes remain the ones named in the resident plan's exact target-file lists; **do not create or edit Dart files in Goal 2**. In particular, the admin session below is not the resident `DemoSession`, and a catalog publication label is not `VoucherStatus`.

#### B. Admin-only models and list contracts

`admin.ts` imports shared types from `./shared.ts` using `import type`. Export the following declarations exactly:

```ts
import type {
  ISODateTime, MaterialType, SmartBin, DepositTransaction, ResidentProfile,
  WalletSnapshot, MaterialRate, RecyclingSummary, RewardDocument
} from "./shared.ts";

export type CollectionStatus = "notScheduled" | "pending" | "scheduled" | "collected";
export type AlertStatus = "active" | "resolved";
export type VerificationStatus = "awaitingReview" | "approved" | "rejected";
export type VerificationFlag = "uncertain" | "possibleContaminant";
export type CapacityBand = "normal" | "warning" | "critical";
export type PageSize = 5 | 10 | 20;
export type SortDirection = "asc" | "desc";

export interface SortSpec<K extends string> { key: K; direction: SortDirection; }
export interface ListQuery<K extends string> {
  search: string; page: number; pageSize: PageSize; sort: SortSpec<K>;
}
export interface Page<T> { items: T[]; total: number; page: number; pageSize: PageSize; }
export interface BinOperations { binId: string; collectionStatus: CollectionStatus; }
export interface SmartBinRow { bin: SmartBin; operations: BinOperations; }
export interface CapacityAlert {
  id: string; binId: string; status: AlertStatus; thresholdPercent: number;
  triggeredAt: ISODateTime; resolvedAt: ISODateTime | null;
}
export interface CapacityAlertRow {
  alert: CapacityAlert; bin: SmartBin; operations: BinOperations;
}
export interface AlertPage extends Page<CapacityAlertRow> {
  activeCount: number; resolvedCount: number;
}
export interface VerificationTicket {
  id: string; transactionId: string; predictedMaterialType: MaterialType;
  predictedMaterialLabel: string; confidencePercent: number;
  captureDescription: string; captureImageUrl: string | null;
  flag: VerificationFlag; status: VerificationStatus;
  reviewedAt: ISODateTime | null; reviewedByAdminId: string | null;
}
export interface VerificationDetail {
  ticket: VerificationTicket; transaction: DepositTransaction;
  resident: ResidentProfile; bin: SmartBin;
}
export interface VerificationDecisionResult {
  detail: VerificationDetail; wallet: WalletSnapshot;
}
export interface AdminIdentity { id: string; fullName: string; email: string; }
export interface AdminSession {
  id: string; adminId: string; isSignedIn: boolean; startedAt: ISODateTime;
}
export interface AdminLoginRequest { email: string; password: string; }
export interface AdminSettings {
  id: "global"; capacityAlertThreshold: 75 | 80 | 85;
  acceptedMaterials: MaterialType[]; materialRates: MaterialRate[];
  updatedAt: ISODateTime;
}
export interface ProgramSettingsDocument {
  id: "global"; capacityAlertThreshold: 75 | 80 | 85;
  acceptedMaterials: MaterialType[]; updatedAt: ISODateTime;
}
export interface DailyActivity { date: string; verifiedDepositCount: number; }
export interface MaterialMixEntry {
  materialType: MaterialType; displayName: string; weightKg: number;
}
export interface DashboardSummary {
  registeredBins: number; activeAlerts: number; verifiedDeposits: number;
  ecoPointsIssued: number; totalWeightKg: number;
  activity: DailyActivity[]; materialMix: MaterialMixEntry[];
  attentionBins: SmartBinRow[]; updatedAt: ISODateTime;
}
export interface ResidentSnapshot {
  profile: ResidentProfile; wallet: WalletSnapshot;
  deposits: DepositTransaction[]; summary: RecyclingSummary;
}

export type BinInput = Omit<SmartBin, "id" | "lastUpdatedAt">;
export type RewardInput = Omit<RewardDocument, "id">;
export type SettingsInput = Pick<AdminSettings,
  "capacityAlertThreshold" | "acceptedMaterials" | "materialRates">;

export type BinSortKey = "id" | "locationName" | "capacityPercent" | "lastUpdatedAt";
export interface BinListQuery extends ListQuery<BinSortKey> {
  capacityBand: CapacityBand | "all";
  collectionStatus: CollectionStatus | "all";
  online: "all" | "online" | "offline";
}
export type AlertSortKey = "triggeredAt" | "capacityPercent";
export interface AlertListQuery extends ListQuery<AlertSortKey> { status: AlertStatus; }
export type VerificationSortKey = "occurredAt" | "confidencePercent";
export interface VerificationListQuery extends ListQuery<VerificationSortKey> {
  status: VerificationStatus;
}
export type RewardSortKey = "title" | "pointsCost" | "expiresAt";
export interface RewardListQuery extends ListQuery<RewardSortKey> {
  categoryId: string | null; publication: "all" | "active" | "draft";
}

export interface AdminRecords {
  BinOperations: BinOperations;
  CapacityAlert: CapacityAlert;
  VerificationTicket: VerificationTicket;
  AdminIdentity: AdminIdentity;
  AdminSession: AdminSession;
  AdminLoginRequest: AdminLoginRequest;
  AdminSettings: AdminSettings;
  ProgramSettingsDocument: ProgramSettingsDocument;
}
export type AdminDocumentRecords = Pick<AdminRecords,
  "BinOperations" | "CapacityAlert" | "VerificationTicket" |
  "AdminIdentity" | "ProgramSettingsDocument">;
```

`DailyActivity.date` is a calendar `YYYY-MM-DD` label, not an instant. `MaterialMixEntry.weightKg` and `DashboardSummary.totalWeightKg` are read-time analytics projections calculated from each verified transaction's `itemCount` and the fixed system kg-per-piece conversion table. They are never stored on `DepositTransaction`, configured by Admin, or used in points calculations. `Reward.residentRedemptionCount` and `WalletSnapshot.nextRewardCost` are computed read projections and absent from document writers. `AdminSettings` joins `ProgramSettingsDocument` with separate rate records; joined rows/receipts/dashboard/auth/session/request objects are not members of either document registry. Keep every declared shared field aligned with Flutter; future Firebase adapters cannot write read models wholesale.

#### C. JSON codec exports

Implement Zod schemas in `codecs.ts`; imports are `z` from `zod`, types from `./shared.ts`, and types from `./admin.ts`. These are **signature specifications**; implement the bodies in the target module, not as bodyless `.ts` declarations.

```ts
import { z } from "zod";
import type { ISODateTime, SharedRecords, SharedDocumentRecords } from "./shared.ts";
import type { AdminRecords, AdminDocumentRecords } from "./admin.ts";

export const sharedSchemas: { [K in keyof SharedRecords]: z.ZodType<SharedRecords[K], z.ZodTypeDef, unknown> };
export const adminSchemas: { [K in keyof AdminRecords]: z.ZodType<AdminRecords[K], z.ZodTypeDef, unknown> };
export function decodeShared<K extends keyof SharedRecords>(kind: K, value: unknown): SharedRecords[K];
export function encodeShared<K extends keyof SharedRecords>(kind: K, value: SharedRecords[K]): string;
export function decodeAdmin<K extends keyof AdminRecords>(kind: K, value: unknown): AdminRecords[K];
export function normalizeTimestamp(value: unknown): ISODateTime;
export function decodeSharedDocument<K extends keyof SharedDocumentRecords>(kind: K, documentId: string, value: unknown): SharedDocumentRecords[K];
export function encodeSharedDocument<K extends keyof SharedDocumentRecords>(kind: K, value: SharedDocumentRecords[K]): Record<string, unknown>;
export function decodeAdminDocument<K extends keyof AdminDocumentRecords>(kind: K, documentId: string, value: unknown): AdminDocumentRecords[K];
export function encodeAdminDocument<K extends keyof AdminDocumentRecords>(kind: K, value: AdminDocumentRecords[K]): Record<string, unknown>;
```

Rules: strict object keys; required nullable keys use `.nullable()`, not `.optional()`; finite nonnegative item counts/points; integer item counts, points, rates, order and version, including `walletBalanceAfter` and `walletVersion`; 0–100 capacities/confidence; offset-aware datetime strings. Review deposits require null points/verification date, rejected deposits zero points/null verification date, verified deposits numeric points/verification date. Unknown shared material/status/outcome/voucher wire values normalize to `unknown`; unknown `ScanStage`/role/admin workflow values fail. Validate filter ordering, unique rates and string IDs; malformed fields must fail, never be fabricated.

`normalizeTimestamp` accepts an ISO instant, native Date or plain `{seconds: number, nanoseconds: number}` value with integer fields, and emits UTC ISO at millisecond precision. Document codecs normalize **declared instant fields only**, inject a missing declared ID from `documentId`, and reject a mismatching embedded ID. The ID field is `residentId` for WalletDocument/preferences/security, `materialType` for MaterialRate, `binId` for BinOperations, otherwise `id`; IDs stay strings, including Auth UIDs. SDK-free maps emit ISO strings now; real Timestamp/server-timestamp conversion stays inside future Firebase adapters. Validate nullable URL fields as null or HTTPS strings; reject file/reference objects and `gs://` values. AuthState signed-out/signed-in combinations must satisfy the shared invariant; never serialize credentials/claims as profile document data.

`.gitignore` contains `node_modules/`, `dist/`, `test-results/`, and `playwright-report/`. `contracts.test.ts` uses only `node:test` and `node:assert/strict`, imports codec functions and schema maps, and supplies valid examples for **all 27 `SharedRecords` keys**. Test flat document round-trips separately from nested response-only round-trips, UID/key mismatches, Timestamp-parts/ISO equivalence, URL strings/nulls, AuthState claims/nullability, unknown shared enums, malformed data and rejection of Figma catalog objects or nested session/redemption documents.

### 5. Anti-Hallucination Guardrails ("DO NOT" Rules)

- Do NOT import Firebase Timestamp/DocumentReference or initialize SDKs for codecs; plain map/string/date tests must work without Firebase dependencies. Do NOT persist read responses, claims or credentials as documents.
- Do NOT change any shared field spelling, type, enum value, or nullable key from the block above.
- Do NOT append collection status/confidence/admin IDs to `SmartBin`, `DepositTransaction`, or `ResidentProfile`.
- Do NOT add `Reward.status`, `Reward.name`, `Reward.cost`, or `ResidentVoucher.pointsCost`.
- Do NOT implement UI/repositories, edit `main.tsx`, or create Dart classes in this phase.
- Do NOT add a package or bypass validation with `any`, `@ts-ignore`, non-null assertions on unknown JSON, or broad `as SomeModel` casts.
- Do NOT call object-only Zod methods such as `.omit()`/`.shape` on the registry's generic `ZodType` values; build private typed ZodObject schemas first, then assign the declared registry. Do not invent schema fields to silence a type error.

### 6. Step-by-Step Verification Gate

Working directory: `apps/admin-web`.

1. Run `npm run check:tests`; the test imports must traverse all contract/schema modules.
2. Run `npm test`; every shared-model example must round-trip and invalid examples must fail.
3. Run `npm run lint` and `npm run build`; the original bootstrap still compiles.
4. Run `npm run dev` and confirm the bootstrap remains visually unchanged with no runtime module errors.
5. Inspect the shared interfaces beside the resident plan's model tables; confirm `aluminium`, `pointsCost`, `capacityPercent`, and nullable pending points exactly match.
6. Verify all 27 shared keys, document allowlists, flat reference fields, nullable URL fields, UID matching, role values and SDK-free Timestamp conversion match Flutter; no live Firebase import/call is allowed.

---

## Phase 3 — Repository contracts and stateful in-memory services

### 1. Scope & Objective

Create one stateful mock store and typed asynchronous repositories for every planned admin operation. Make CRUD, collection transitions, moderation credits, dashboard totals, failure injection and cross-screen refresh work before any business screen is built.

### 2. Source Figma Make Files (Read-Only Reference)

- `EcoLoop_AI_Figma_Design_Artifacts/src/App.tsx`: state in `AdminApp`, `simulate`, `collect`, `resolve`, `Overview`, `BinTable`, `Verification`, `AdminVouchers`, `AdminSettings`.
- `EcoLoop_AI_Figma_Design_Artifacts/src/index.css`: status bands and empty/success presentation requirements.
- Read the completed `contracts/shared.ts`, `contracts/admin.ts`, and `contracts/codecs.ts` before coding.

### 3. Target Files to Create or Modify

**Exactly 5 targets:**

1. Create `apps/admin-web/src/data/repositories.ts`
2. Create `apps/admin-web/src/data/mockSeeds.ts`
3. Create `apps/admin-web/src/data/mockRepositories.ts`
4. Create `apps/admin-web/src/app/services.ts`
5. Modify `apps/admin-web/tests/contracts.test.ts`

### 4. Explicit Contracts & Signatures

#### A. Repository interfaces — `data/repositories.ts`

Import the existing shared/admin types, then export exactly these interfaces and errors. Async CRUD/read/auth methods return Promise and await delays; `watch*` methods return the SDK-free Observable contract below, with a delayed initial event and later atomic-commit events. Both sets remain required; a revision counter alone is not a replacement for reactive repository interfaces.

```ts
import type { AuthState, RewardCategory, Reward } from "../contracts/shared.ts";
import type {
  AdminSession, AdminIdentity, AdminLoginRequest, DashboardSummary,
  BinListQuery, Page, SmartBinRow, BinInput, AlertListQuery, AlertPage,
  CapacityAlertRow, VerificationListQuery, VerificationDetail,
  VerificationDecisionResult, RewardListQuery, RewardInput,
  AdminSettings, SettingsInput, ResidentSnapshot
} from "../contracts/admin.ts";

export type FailureCode = "unavailable" | "invalidData" | "notFound" |
  "validation" | "conflict" | "insufficientPoints" | "invalidQr" |
  "binUnavailable" | "invalidTransition" | "unauthenticated" | "permissionDenied";
export interface RepositoryFailure {
  code: FailureCode; message: string; fieldErrors: Record<string, string>;
}
export class RepositoryError extends Error {
  readonly code: FailureCode;
  readonly fieldErrors: Record<string, string>;
  constructor(failure: RepositoryFailure);
}
export type Unsubscribe = () => void;
export interface Observer<T> {
  next(value: T): void;
  error(failure: RepositoryFailure): void;
}
export interface Observable<T> {
  subscribe(observer: Observer<T>): Unsubscribe;
}
export interface AuthRepository {
  getAuthState(): Promise<AuthState>;
  watchAuthState(): Observable<AuthState>;
  getSession(): Promise<AdminSession>;
  watchSession(): Observable<AdminSession>;
  getIdentity(): Promise<AdminIdentity>;
  watchIdentity(): Observable<AdminIdentity | null>;
  getDemoCredentials(): Promise<AdminLoginRequest>;
  login(input: AdminLoginRequest): Promise<AdminSession>;
  logout(): Promise<void>;
}
export interface DashboardRepository {
  getSummary(): Promise<DashboardSummary>;
  watchSummary(): Observable<DashboardSummary>;
}
export interface BinsRepository {
  list(query: BinListQuery): Promise<Page<SmartBinRow>>;
  watchList(query: BinListQuery): Observable<Page<SmartBinRow>>;
  get(id: string): Promise<SmartBinRow>;
  watch(id: string): Observable<SmartBinRow | null>;
  create(id: string, input: BinInput): Promise<SmartBinRow>;
  update(id: string, input: BinInput): Promise<SmartBinRow>;
  delete(id: string): Promise<void>;
  simulateCapacity(id: string, capacityPercent: number): Promise<SmartBinRow>;
}
export interface AlertsRepository {
  list(query: AlertListQuery): Promise<AlertPage>;
  watchList(query: AlertListQuery): Observable<AlertPage>;
  get(id: string): Promise<CapacityAlertRow>;
  watch(id: string): Observable<CapacityAlertRow | null>;
  schedule(id: string): Promise<CapacityAlertRow>;
  collect(id: string): Promise<CapacityAlertRow>;
  resolve(id: string): Promise<CapacityAlertRow>;
}
export interface VerificationRepository {
  list(query: VerificationListQuery): Promise<Page<VerificationDetail>>;
  watchList(query: VerificationListQuery): Observable<Page<VerificationDetail>>;
  get(id: string): Promise<VerificationDetail>;
  watch(id: string): Observable<VerificationDetail | null>;
  decide(id: string, decision: "approve" | "reject", idempotencyKey: string): Promise<VerificationDecisionResult>;
}
export interface AdminRewardsRepository {
  list(query: RewardListQuery): Promise<Page<Reward>>;
  watchList(query: RewardListQuery): Observable<Page<Reward>>;
  get(id: string): Promise<Reward>;
  watch(id: string): Observable<Reward | null>;
  getCategories(): Promise<RewardCategory[]>;
  watchCategories(): Observable<RewardCategory[]>;
  create(input: RewardInput): Promise<Reward>;
  update(id: string, input: RewardInput): Promise<Reward>;
  delete(id: string): Promise<void>;
}
export interface SettingsRepository {
  get(): Promise<AdminSettings>;
  watch(): Observable<AdminSettings>;
  update(input: SettingsInput): Promise<AdminSettings>;
}
export interface ResidentReadRepository {
  getSnapshot(residentId: string): Promise<ResidentSnapshot>;
  watchSnapshot(residentId: string): Observable<ResidentSnapshot>;
}
export interface AdminRepositories {
  auth: AuthRepository; dashboard: DashboardRepository; bins: BinsRepository;
  alerts: AlertsRepository; verification: VerificationRepository;
  rewards: AdminRewardsRepository; settings: SettingsRepository;
  residents: ResidentReadRepository;
}
export type OperationName =
  "auth.getAuthState" | "auth.getSession" | "auth.getIdentity" | "auth.getDemoCredentials" | "auth.login" | "auth.logout" |
  "dashboard.getSummary" | "bins.list" | "bins.get" | "bins.create" | "bins.update" | "bins.delete" |
  "bins.simulateCapacity" | "alerts.list" | "alerts.get" | "alerts.schedule" | "alerts.collect" |
  "alerts.resolve" | "verification.list" | "verification.get" | "verification.decide" |
  "rewards.list" | "rewards.get" | "rewards.getCategories" | "rewards.create" | "rewards.update" |
  "rewards.delete" | "settings.get" | "settings.update" | "residents.getSnapshot";
export interface MockControls {
  failNext(operation: OperationName): void;
  setLatency(readMs: number, writeMs: number): void;
  setAuthState(state: AuthState): void;
  reset(): void;
}
export interface MockBundle {
  repositories: AdminRepositories; controls: MockControls;
  subscribe(listener: () => void): () => void;
  getRevision(): number;
}
```

`RepositoryError` is an ordinary class with an implemented constructor; the block above specifies its public signature only. Do not write bodyless method declarations as if they were implementations.

Exact watch-to-read operation-key mapping for initial latency/failure injection: `watchAuthState → auth.getAuthState`, `watchSession → auth.getSession`, `watchIdentity → auth.getIdentity`, `watchSummary → dashboard.getSummary`, every `watchList → <repository>.list`, every ID-based `watch → <repository>.get`, `watchCategories → rewards.getCategories`, settings `watch → settings.get`, and `watchSnapshot → residents.getSnapshot`. There are no separate invented operation names or SDK subscriptions. `MockControls.setAuthState` is test/scenario-only and may simulate role/UID changes; no UI may call it or edit claims.

#### B. Exact seed contract — `data/mockSeeds.ts`

Export `MOCK_NOW`, `MOCK_LOGIN`, `createSeedState()` and `MockSeedState`. The factory returns a **new deep copy** on every call; seed arrays never live inside a UI file.

```ts
import type {
  AuthState, ResidentProfile, WalletDocument, SmartBin, DepositTransaction, MaterialRate,
  RewardCategory, RewardDocument, ResidentVoucher, RewardRedemption
} from "../contracts/shared.ts";
import type {
  AdminLoginRequest, BinOperations, CapacityAlert, VerificationTicket,
  ProgramSettingsDocument, AdminIdentity, AdminSession, VerificationDecisionResult
} from "../contracts/admin.ts";

export const MOCK_NOW = "2024-05-20T11:00:00+08:00";
export const MOCK_LOGIN: AdminLoginRequest = {
  email: "admin@ecoloop.demo", password: "AdminDemo123!"
};
export interface MockSeedState {
  residents: ResidentProfile[]; wallets: WalletDocument[];
  bins: SmartBin[]; binOperations: BinOperations[]; alerts: CapacityAlert[];
  deposits: DepositTransaction[]; tickets: VerificationTicket[];
  categories: RewardCategory[]; rewards: RewardDocument[];
  vouchers: ResidentVoucher[]; redemptions: RewardRedemption[];
  programSettings: ProgramSettingsDocument; materialRates: MaterialRate[];
  admin: AdminIdentity; adminSession: AdminSession; authState: AuthState;
  decisionReceipts: Record<string, VerificationDecisionResult>;
}
export function createSeedState(): MockSeedState;
```

Use these complete typed seed arrays/objects. Seed entities are flat document records; settings/wallet/reward projections are composed by repositories. Implement the factory as cloning these exact seeds, not generating random seed records or introducing integer ID counters.

```ts
const residents: ResidentProfile[] = [
  { id: "RES-000842", fullName: "Faris Rezza", email: "rezza@example.com", avatarUrl: null, createdAt: "2024-04-01T09:00:00+08:00" },
  { id: "RES-000843", fullName: "Aina Lim", email: "aina@example.com", avatarUrl: null, createdAt: "2024-04-02T09:00:00+08:00" }
];
const wallets: WalletDocument[] = [
  { residentId: "RES-000842", balance: 245, updatedAt: MOCK_NOW, version: 0 },
  { residentId: "RES-000843", balance: 120, updatedAt: MOCK_NOW, version: 0 }
];
const bins: SmartBin[] = [
  { id: "BIN-004", locationName: "Cedar Residence", locationDetail: "Ground Floor", capacityPercent: 65, acceptedMaterials: ["plastic", "aluminium"], isOnline: true, lastUpdatedAt: MOCK_NOW },
  { id: "BIN-002", locationName: "Maple Lobby", locationDetail: "Recycling Corner", capacityPercent: 34, acceptedMaterials: ["plastic", "aluminium", "paper"], isOnline: true, lastUpdatedAt: MOCK_NOW },
  { id: "BIN-007", locationName: "Town Square", locationDetail: "Recycling Corner", capacityPercent: 40, acceptedMaterials: ["paper", "plastic"], isOnline: true, lastUpdatedAt: MOCK_NOW },
  { id: "BIN-011", locationName: "Town Square", locationDetail: "West Entrance", capacityPercent: 78, acceptedMaterials: ["plastic", "aluminium"], isOnline: true, lastUpdatedAt: MOCK_NOW },
  { id: "BIN-008", locationName: "Maple Apartments", locationDetail: "Lobby", capacityPercent: 62, acceptedMaterials: ["paper", "glass"], isOnline: true, lastUpdatedAt: MOCK_NOW }
];
const binOperations: BinOperations[] = [
  { binId: "BIN-004", collectionStatus: "notScheduled" },
  { binId: "BIN-002", collectionStatus: "collected" },
  { binId: "BIN-007", collectionStatus: "notScheduled" },
  { binId: "BIN-011", collectionStatus: "notScheduled" },
  { binId: "BIN-008", collectionStatus: "scheduled" }
];
const plasticToday: DepositTransaction = {
  id: "DEP-1088", residentId: "RES-000842", sessionId: null,
  binId: "BIN-004", binLocation: "Cedar Residence", materialType: "plastic",
  materialLabel: "PET plastic", itemCount: 4, pointsAwarded: 20,
  status: "verified", occurredAt: "2024-05-20T10:42:00+08:00",
  verifiedAt: "2024-05-20T10:43:00+08:00"
};
const olderPlastic: DepositTransaction = {
  ...plasticToday, id: "DEP-1001", itemCount: 2, pointsAwarded: 10,
  occurredAt: "2024-05-15T09:00:00+08:00", verifiedAt: "2024-05-15T09:01:00+08:00"
};
const deposits: DepositTransaction[] = [
  plasticToday,
  { ...plasticToday, id: "DEP-1086", binId: "BIN-002", binLocation: "Maple Lobby", materialType: "aluminium", materialLabel: "Aluminium", itemCount: 2, pointsAwarded: 16, occurredAt: "2024-05-18T16:16:00+08:00", verifiedAt: "2024-05-18T16:17:00+08:00" },
  olderPlastic,
  { ...olderPlastic, id: "DEP-1002", materialType: "paper", materialLabel: "Paper", itemCount: 2, pointsAwarded: 6, occurredAt: "2024-05-14T09:00:00+08:00", verifiedAt: "2024-05-14T09:01:00+08:00" },
  { ...olderPlastic, id: "DEP-1003", materialType: "glass", materialLabel: "Glass", itemCount: 1, pointsAwarded: 10, occurredAt: "2024-05-13T09:00:00+08:00", verifiedAt: "2024-05-13T09:01:00+08:00" },
  { ...olderPlastic, id: "DEP-1004", materialType: "plastic", materialLabel: "PET plastic", itemCount: 2, pointsAwarded: 10, occurredAt: "2024-05-12T09:00:00+08:00", verifiedAt: "2024-05-12T09:01:00+08:00" },
  { ...olderPlastic, id: "DEP-1005", materialType: "aluminium", materialLabel: "Aluminium", itemCount: 2, pointsAwarded: 16, occurredAt: "2024-05-11T09:00:00+08:00", verifiedAt: "2024-05-11T09:01:00+08:00" },
  { ...olderPlastic, id: "DEP-1006", materialType: "paper", materialLabel: "Paper", itemCount: 2, pointsAwarded: 6, occurredAt: "2024-05-10T09:00:00+08:00", verifiedAt: "2024-05-10T09:01:00+08:00" },
  { ...olderPlastic, id: "DEP-1007", materialType: "glass", materialLabel: "Glass", itemCount: 1, pointsAwarded: 10, occurredAt: "2024-05-09T09:00:00+08:00", verifiedAt: "2024-05-09T09:01:00+08:00" },
  { ...olderPlastic, id: "DEP-1008", materialType: "plastic", materialLabel: "PET plastic", itemCount: 2, pointsAwarded: 10, occurredAt: "2024-05-08T09:00:00+08:00", verifiedAt: "2024-05-08T09:01:00+08:00" },
  { ...olderPlastic, id: "DEP-1009", materialType: "aluminium", materialLabel: "Aluminium", itemCount: 2, pointsAwarded: 16, occurredAt: "2024-05-07T09:00:00+08:00", verifiedAt: "2024-05-07T09:01:00+08:00" },
  { ...olderPlastic, id: "DEP-1010", materialType: "plastic", materialLabel: "PET plastic", itemCount: 4, pointsAwarded: 20, occurredAt: "2024-05-06T09:00:00+08:00", verifiedAt: "2024-05-06T09:01:00+08:00" },
  { ...plasticToday, id: "DEP-1087", binId: "BIN-007", binLocation: "Town Square", materialType: "paper", materialLabel: "Paper", itemCount: 4, pointsAwarded: null, status: "review", occurredAt: "2024-05-16T09:08:00+08:00", verifiedAt: null },
  { ...plasticToday, id: "DEP-1081", residentId: "RES-000843", materialLabel: "Mixed plastic container", itemCount: 2, pointsAwarded: null, status: "review", occurredAt: "2024-05-20T09:46:00+08:00", verifiedAt: null }
];
const tickets: VerificationTicket[] = [
  { id: "REV-1087", transactionId: "DEP-1087", predictedMaterialType: "paper", predictedMaterialLabel: "Paper / mixed packaging", confidencePercent: 62, captureDescription: "Flattened drink carton", captureImageUrl: null, flag: "uncertain", status: "awaitingReview", reviewedAt: null, reviewedByAdminId: null },
  { id: "REV-1081", transactionId: "DEP-1081", predictedMaterialType: "plastic", predictedMaterialLabel: "Mixed plastic container", confidencePercent: 48, captureDescription: "Container with possible food residue", captureImageUrl: null, flag: "possibleContaminant", status: "awaitingReview", reviewedAt: null, reviewedByAdminId: null }
];
const categories: RewardCategory[] = [
  { id: "food", label: "Food", sortOrder: 0 },
  { id: "shopping", label: "Shopping", sortOrder: 1 }
];
const rewardBase: Omit<RewardDocument, "id" | "title" | "pointsCost"> = {
  description: "Illustrative demo reward", merchantName: "Demo merchant",
  categoryId: "food", tag: null, imageUrl: null, expiresAt: "2024-06-30T23:59:59+08:00",
  isActive: true, maxRedemptionsPerResident: 1,
  artKey: "art0", sortOrder: 0
};
const rewards: RewardDocument[] = [
  { ...rewardBase, id: "RWD-SNACK", title: "Vending snack", pointsCost: 100, tag: "Popular" },
  { ...rewardBase, id: "RWD-CAFE", title: "RM5 café voucher", pointsCost: 200, tag: "Food & drink", artKey: "art1", sortOrder: 1 },
  { ...rewardBase, id: "RWD-MEAL", title: "Meal voucher", pointsCost: 350, tag: "Dining", artKey: "art2", sortOrder: 2 },
  { ...rewardBase, id: "RWD-SHOP", title: "RM10 shopping voucher", pointsCost: 500, categoryId: "shopping", tag: "Shopping", artKey: "art3", sortOrder: 3 },
  { ...rewardBase, id: "RWD-TOTE", title: "Township tote bag", pointsCost: 350, categoryId: "shopping", isActive: false, artKey: "art2", sortOrder: 4 }
];
const vouchers: ResidentVoucher[] = [
  { id: "VCH-WELCOME", residentId: "RES-000842", rewardId: null, title: "RM3 Welcome voucher", merchantName: "Demo merchant", code: "ECO-WELCOME-842", terms: "One redemption at the demo merchant.", issuedAt: "2024-05-01T09:00:00+08:00", expiresAt: "2024-05-31T23:59:59+08:00", status: "available", remainingUses: 1, usedAt: null }
];
const programSettings: ProgramSettingsDocument = {
  id: "global", capacityAlertThreshold: 80,
  acceptedMaterials: ["plastic", "aluminium", "paper", "glass"],
  updatedAt: MOCK_NOW
};
const materialRates: MaterialRate[] = [
    { materialType: "plastic", displayName: "Plastic", pointsPerItem: 5, eligible: true },
    { materialType: "aluminium", displayName: "Aluminium", pointsPerItem: 8, eligible: true },
    { materialType: "paper", displayName: "Paper", pointsPerItem: 3, eligible: true },
    { materialType: "glass", displayName: "Glass", pointsPerItem: 10, eligible: true }
];
const admin: AdminIdentity = { id: "ADM-001", fullName: "Jamie Lee", email: "admin@ecoloop.demo" };
const adminSession: AdminSession = { id: "ADMIN-DEMO-001", adminId: "ADM-001", isSignedIn: false, startedAt: MOCK_NOW };
const authState: AuthState = { uid: null, role: null, isSignedIn: false };
const alerts: CapacityAlert[] = [];
const redemptions: RewardRedemption[] = [];
const decisionReceipts: Record<string, VerificationDecisionResult> = {};
```

The second resident's review record preserves Faris's exact resident-plan baseline of **12 verified / 26 pcs / 1.04 kg derived weight / one pending review / 245 opening points**. Seed locations favor the resident plan where Figma admin and resident examples conflict. Four active rewards match that plan; the fifth, draft tote, mirrors the admin-only draft example without entering the resident catalog. Admin settings contain points-per-item rates only; weight conversion remains an internal derived-summary concern.

#### C. Mock semantics — `data/mockRepositories.ts`

Export this factory; import seed factory, codecs and repository types by their exact relative paths:

```ts
export function createMockRepositories(options?: {
  readDelayMs?: number; writeDelayMs?: number;
  idFactory?: (collection: "capacityAlerts" | "rewards") => string;
}): MockBundle;
```

Implement the following in this file, using private helpers rather than extra modules:

1. Default read delay **350 ms**, write delay **650 ms**, implemented with `Promise` + `setTimeout`. Even zero-duration test calls remain asynchronous. A `watch*` call returns an Observable immediately; subscribing registers the listener before a delayed initial snapshot/error, then asynchronously projects committed revisions. Only controls/subscription metadata are synchronous; no Firebase listener, RxJS or network service is used.
2. A factory-local flat-document store; defensive copies on all returns; a serialized write queue and cloned transaction draft. Validate and inject failures before commit; failure changes neither data nor revision. Notify once per actual committed mutation; rollback/idempotent receipt replay is not a new mutation. Observables deduplicate unchanged projections, ignore stale initial/filter responses, never emit after unsubscribe, and detach listeners/timers on cleanup. Recoverable initial errors permit retry/resubscription; never fake successful empty data.
3. A `failNext` set keyed by the exact operation mapping above. Remove a flag when consumed. `reset` restores fresh seeds/receipts and clears failures before notifying. IDs default to `crypto.randomUUID()` strings; tests inject `idFactory`, whose returned ID must be nonblank, slash-free and unique before commit. No integer primary-key counters or fabricated Auth UIDs. Test-only `setAuthState` validates the shared invariant, synchronizes the mock admin session's signed-in flag for matching admin UID/role, and emits asynchronously; it is not an application claim-write method.
4. List pipeline: trimmed case-insensitive search → all selected filters with AND semantics → typed numeric/date/text sorting → stable ID tie-break → pagination. `page` is 1-based; page size is 5/10/20. Clamp an out-of-range page to the last valid page, or 1 when empty, and return that canonical page.
5. Bin search covers ID/locationName/locationDetail. `create` requires a unique nonblank string document ID with no `/`, nonblank location fields, integer capacity 0–100, at least one known accepted material and boolean online state. BIN-020 is a valid demo choice, not an enforced production ID pattern. Update preserves ID; validate with the shared document codec. Delete fails `conflict` for any deposit/alert reference; unreferenced-bin CRUD must work.
6. New bins get `notScheduled` operations. When create/update/simulate reaches `programSettings.capacityAlertThreshold`, create exactly one active alert for that bin and set operations `pending`; do not duplicate an active alert. New alert IDs use `idFactory("capacityAlerts")`. A resolved historical alert is never reopened or overwritten.
7. Alert lifecycle: active+pending/notScheduled → `schedule` → scheduled → `collect` → collected and capacity **10%** → `resolve` → resolved with `resolvedAt`. Wrong transitions fail `invalidTransition`; repeated actions cannot manufacture a second reset. Active alerts stay active after collection until explicit Resolve.
8. `verification.get/list` and their watchers join ticket, transaction, resident and bin by IDs. Approve only an awaiting-review ticket with a review transaction, known accepted material and eligible configured rate. Calculate `itemCount * pointsPerItem`; atomically update flat transaction classification/status/verifiedAt/points, ticket metadata and WalletDocument balance/version/updatedAt. After commit compose WalletSnapshot with its computed next reward cost; never store that projection in the wallet document.
9. Reject sets transaction status `rejected`, points `0`, verifiedAt null, and ticket status `rejected`; wallet is unchanged. Same decision/idempotency key returns its stored receipt; using the key for a different ticket/decision or deciding an already finalized ticket with another key fails `conflict`. Neither repeated button clicks nor refreshes can double-credit. The seeded review deposits have null session IDs, so no invented session mutation is needed.
10. Reward Create/Update validates every `RewardInput` field, known category, positive integer cost, future expiry relative to `MOCK_NOW`, max redemptions >=1, nonnegative sortOrder, valid art0–art3, nullable HTTPS `imageUrl` and nonblank title/merchant/description. New IDs use `idFactory("rewards")`; stored records are RewardDocument, never include `residentRedemptionCount`. Compose that field as 0 in admin views (there is no selected resident); resident adapters derive the owner's actual count. Delete fails for issued voucher/redemption references. Draft/Active maps to `isActive` only.
11. Compute each returned WalletSnapshot's next higher active/unexpired reward cost from catalog documents, preserving stored wallet balance. Do not write computed nextRewardCost to WalletDocument or issue/consume a voucher when editing catalog records.
12. Settings validates threshold 75/80/85, unique known accepted materials (at least one), exactly one rate per plastic/aluminium/paper/glass, integer rates 0–1000 and eligible flags matching selected materials. Atomically update separate programSettings/materialRates documents; compose AdminSettings for reads/watch. Reconcile qualifying bins into alerts, but never auto-resolve old alerts or recalculate historical credit.
13. Dashboard derives registered bin count, active alert count, verified deposit count, sum of verified `pointsAwarded`, total verified weight, seven Kuala Lumpur calendar days ending on MOCK_NOW, material weight totals, and attention bins with capacity >=60. Daily activity groups verified records by `verifiedAt` in that timezone; a later approval contributes on its verification day. Never copy the source's hardcoded KPI/bar/donut arrays into UI or repository constants.
14. Resident snapshots filter by the UID string and compute verified impact; wallet balances are opening ledger snapshots, not this abbreviated deposit sum. Login validates mock credentials and atomically updates adminSession plus AuthState `{uid: "ADM-001", role: "admin", isSignedIn: true}`; logout emits null/null/false. Business reads/CRUD/watch require the matching signed-in admin UID and `admin` claim; use unauthenticated/permissionDenied failures otherwise. On UID/claim/sign-out changes, clear private projections and cancel stale work; auth methods remain usable before login. No live Auth UID/token/claim SDK call is made.

#### D. App-scoped composition/hooks — `app/services.ts`

This `.ts` file imports React hooks by name, not JSX. It is the **only production module** that instantiates the mock bundle; screens do not call the factory.

```ts
export const services: MockBundle;
export interface QueryState<T> {
  data: T | null; loading: boolean; refreshing: boolean;
  error: string | null; reload: () => void;
}
export interface MutationState {
  pending: boolean; error: string | null;
  run<T>(operation: () => Promise<T>): Promise<T | null>;
  clearError(): void;
}
export function useRepositoryRevision(): number;
export function useQuery<T>(key: string, loader: () => Promise<T>): QueryState<T>;
export function useObservableQuery<T>(key: string, source: () => Observable<T>): QueryState<T>;
export function useMutation(): MutationState;
```

`useQuery` observes revision, uses a ref for the latest loader, and reloads on key/revision/retry changes only. Ignore late results after key changes/unmount; distinguish initial load from refreshing old data; do not turn an old query's result into a newer filter result. `useMutation` uses a synchronous in-flight ref guard as well as rendered pending state, clears previous errors on retry and returns null on failure; use result objects for successful writes, and a resolved boolean wrapper for successful `void` operations. Public hooks never expose the writable seed store.

Import `Observable` from `../data/repositories.ts` in services.ts. `useObservableQuery` uses the latest source ref, subscribes only on key/retry changes, unsubscribes on change/unmount and ignores late values from the old subscription. `reload` resubscribes; the source already emits on mutations, so this hook must not also refetch on the revision counter. Errors become QueryState errors; unauthenticated/permissionDenied also clear private data. Use it for live lists/details/settings/dashboard/auth; keep `useQuery`/Promise methods for explicit one-shot reads and form preloads. Future Firebase adapters map snapshot listeners and Auth UID/ID-token claim changes into the same interface.

Until Phase 10, these contracts already work; Phase 10 audits and hardens them rather than inventing a second state-management system. No browser/global test backdoor is required; failure/empty cases are exercised with fresh repository factories in unit tests.

### 5. Anti-Hallucination Guardrails ("DO NOT" Rules)

- Do NOT implement observables with live Firebase `onSnapshot`/`onAuthStateChanged`, install SDK/RxJS packages, or persist nested read models/integer primary-key counters; implement SDK-free stateful mocks with the exact watch contracts above.
- Do NOT hardcode list rows, KPI totals, bar series, or material-mix percentages in presentation files.
- Do NOT call `fetch`, create `/api` routes, install packages, use localStorage, or connect the two mock apps.
- Do NOT mutate imported seed arrays directly or share a singleton between unit-test cases.
- Do NOT expose a public set-balance operation, approve/reject booleans detached from a ticket ID, or delete referenced records.
- Do NOT bypass the listed interfaces with direct store access in screens.
- Do NOT edit Phase 2 contracts to accommodate an implementation mistake; implement exactly the specified signatures.

### 6. Step-by-Step Verification Gate

Working directory: `apps/admin-web`.

1. Extend `tests/contracts.test.ts` with fresh factories and `await auth.login(MOCK_LOGIN)` for business tests; use zero delays in most tests and one short-delay test proving async behavior.
2. Assert baseline dashboard: **5 bins, 0 active alerts, 12 verified deposits, 150 issued points, 1.04 kg derived weight**; use tolerance for floating-point weights. Assert Faris wallet 245 and next target 350.
3. Create BIN-020 → read/list it → update location/capacity → delete it; assert mutation counts and no orphan operations record. Deleting referenced BIN-004 must fail without changing state.
4. Simulate BIN-004 to 85 twice → one alert → schedule → collect to 10 → resolve; assert active/resolved counts and reject skipped transitions.
5. Approve REV-1087 → Faris 257, 13 verified, 1.24 kg derived weight; repeat same key → still 257. Reject REV-1081 → Aina remains 120. This is an admin approval of the existing **4 pcs** pending deposit, not the resident scan's new 2 pcs deposit.
6. Test reward create/edit/activate/delete, thresholds, AND filtering/sort/pagination, named failure once/rollback, invalid settings, malformed records, and independent factories. Include a fresh-state paper-rate-30 approval test expecting 24 awarded/269 wallet; test failed writes do not emit revision.
7. Run `npm run check:tests`, `npm run check -- src/app/services.ts`, `npm test`, `npm run lint`, and `npm run build` separately. The explicit services check covers the not-yet-mounted hook module. Start the dev server and confirm the bootstrap still renders; business pages are deliberately not introduced yet.
8. Subscribe to every watch API: verify delayed initial snapshot, post-commit updates, filter isolation, no rollback/replay event, no events after unsubscribe and recovery after a named initial failure. Test mocked user-role/UID changes deny admin access and clear private state; no Firebase/network calls occur.

---

## Phase 4 — Reusable admin controls, inputs, badges and dialogs

### 1. Scope & Objective

Build the exact reusable control vocabulary used by every admin screen. Provide typed props, accessible dialogs and consistent feedback without introducing business records or screen-specific repositories.

### 2. Source Figma Make Files (Read-Only Reference)

- `EcoLoop_AI_Figma_Design_Artifacts/src/App.tsx`: `paths`, `Icon`, `Button`, `Badge`, `Brand`, `AdminTitle`.
- `EcoLoop_AI_Figma_Design_Artifacts/src/index.css`: `.btn`, `.badge`, `.brand`, `.search`, `.success-banner`, `.empty`, `.setting-section`.
- Existing `src/theme.css`; use its tokens instead of restating colors.

### 3. Target Files to Create or Modify

**Exactly 5 targets:**

1. Create `apps/admin-web/src/ui/primitives.tsx`
2. Create `apps/admin-web/src/ui/Modal.tsx`
3. Create `apps/admin-web/src/ui/primitives.css`
4. Modify `apps/admin-web/src/theme.css`
5. Modify `apps/admin-web/src/main.tsx`

### 4. Explicit Contracts & Signatures

`primitives.tsx` exports the following types/components; component functions return `React.ReactElement`. Use `React.ReactNode` for content and namespace React imports, with no unsupported `size`, `icon`, or `className` props invented by consumers.

```ts
export type IconName = "leaf" | "home" | "scan" | "settings" | "bell" |
  "arrow" | "recycle" | "gift" | "history" | "book" | "check" | "bin" |
  "alert" | "grid" | "search" | "chart" | "shield" | "menu" | "close" | "plus" | "camera";
export interface IconProps { name: IconName; size?: number; }
export interface ButtonProps {
  children: React.ReactNode; variant?: "primary" | "secondary" | "danger" | "ghost";
  type?: "button" | "submit"; disabled?: boolean; busy?: boolean;
  onClick?: () => void; testId?: string;
}
export interface TextInputProps {
  id: string; label: string; value: string; onChange: (value: string) => void;
  type?: "text" | "email" | "password" | "number" | "date" | "search";
  error?: string; hint?: string; disabled?: boolean; required?: boolean;
  min?: number; max?: number; step?: number; placeholder?: string;
}
export interface SelectOption { value: string; label: string; }
export interface SelectInputProps {
  id: string; label: string; value: string; options: readonly SelectOption[];
  onChange: (value: string) => void; error?: string; disabled?: boolean;
}
export interface CheckboxInputProps {
  id: string; label: string; checked: boolean;
  onChange: (checked: boolean) => void; disabled?: boolean;
}
export type BadgeTone = "green" | "amber" | "red" | "gray";
export interface BadgeProps { children: React.ReactNode; tone?: BadgeTone; }
export interface FeedbackProps {
  kind: "success" | "error" | "info"; children: React.ReactNode;
  onDismiss?: () => void;
}
export interface AdminPageHeaderProps {
  eyebrow: string; title: string; description?: string; actions?: React.ReactNode;
}
export interface AsyncStateProps {
  kind: "loading" | "error" | "empty"; title: string;
  description?: string; onRetry?: () => void;
}
export function Icon(props: IconProps): React.ReactElement;
export function Brand(): React.ReactElement;
export function Button(props: ButtonProps): React.ReactElement;
export function TextInput(props: TextInputProps): React.ReactElement;
export function SelectInput(props: SelectInputProps): React.ReactElement;
export function CheckboxInput(props: CheckboxInputProps): React.ReactElement;
export function Badge(props: BadgeProps): React.ReactElement;
export function Feedback(props: FeedbackProps): React.ReactElement;
export function AdminPageHeader(props: AdminPageHeaderProps): React.ReactElement;
export function AsyncState(props: AsyncStateProps): React.ReactElement;
```

`Icon` copies the exact inline path entries into one private map in this module: 24×24 viewBox, no fill, 1.8 stroke, rounded caps/joins, currentColor. Decorative SVGs are aria-hidden; accessible names belong on the surrounding labeled button. `Brand` uses the leaf icon and source label `EcoLoop AI`.

`Modal.tsx` exports exactly:

```ts
export interface ModalProps {
  open: boolean; title: string; children: React.ReactNode;
  footer: React.ReactNode; onClose: () => void; closeDisabled?: boolean;
}
export interface ConfirmDialogProps {
  open: boolean; title: string; description: string; confirmLabel: string;
  variant?: "primary" | "danger"; busy: boolean; error: string | null;
  onConfirm: () => void; onCancel: () => void;
}
export function Modal(props: ModalProps): React.ReactElement | null;
export function ConfirmDialog(props: ConfirmDialogProps): React.ReactElement | null;
```

Use `createPortal` from `react-dom`, `role="dialog"`, `aria-modal`, heading association, focus containment, Escape/overlay-close when not busy, focus restoration, and scroll lock with cleanup. A dialog's error appears inside it; a failed submit does not close it.

`primitives.css` owns `.btn`, `.badge`, `.form-field`, `.form-error`, `.checkbox-field`, `.feedback`, `.dialog-backdrop`, `.dialog`, `.admin-title`, `.async-state`, `.brand`, `.icon`. Global token additions remain in `theme.css`; no raw feature palette variants are introduced.

Replace `BootstrapPreview` content with a temporary controlled preview using all primitive exports, an empty input string, one checkbox and an open/close confirmation. These are UI-demo state, **not fake bin/reward/customer data**. No shared domain models or repository changes are required.

### 5. Anti-Hallucination Guardrails ("DO NOT" Rules)

- Do NOT add native-element props to component calls unless they appear in the explicit props above.
- Do NOT add Firebase/Auth/Storage upload calls to buttons or inputs; URL fields remain strings/null and all visible behavior is local/mock-only.
- Do NOT assume a UI kit's Dialog, Input, toast, or icon import exists.
- Do NOT put customer identities, catalog arrays, or repository calls in shared UI components.
- Do NOT add packages, new assets/files, or a second token stylesheet.
- Do NOT leave an active dialog able to submit twice or dismiss while its write is pending.

### 6. Step-by-Step Verification Gate

Working directory: `apps/admin-web`.

1. Run `npm run lint`, `npm run check:tests`, `npm test`, and `npm run build` separately.
2. In the dev preview, exercise button variants/disabled/busy appearance, typing, selection, checkbox state, badge tones and feedback dismissal.
3. Open a dialog with keyboard, Tab/Shift+Tab through it, press Escape and verify focus returns to its trigger. Busy confirmation must disable close and confirm.
4. Check 390/900/1440 widths and 200% zoom; labels/errors and the dialog footer must fit without clipping.
5. Verify copied SVGs have no missing icon names and no externally loaded fonts/images.
6. Review primitive imports/callbacks for the mock-only rule: no Firebase/Storage/App Check initialization, upload task or native config edit was introduced.

---

## Phase 5 — Generic data table, search/filter bar and pagination

### 1. Scope & Objective

Build table and list controls with exact generic contracts that every list screen will reuse. Centralize URL-query parsing so filtering, sorting and pagination use repository field names rather than guessed presentation properties.

### 2. Source Figma Make Files (Read-Only Reference)

- `EcoLoop_AI_Figma_Design_Artifacts/src/App.tsx`: `BinTable`, `Bins` toolbar, `AdminVouchers` table, `Alerts` tabs.
- `EcoLoop_AI_Figma_Design_Artifacts/src/index.css`: `.table-wrap`, table header/cell rules, `.toolbar`, `.search`, `.capacity`, `.tabs`, responsive admin rules.
- Existing `contracts/admin.ts`, `ui/primitives.tsx`, and `data/repositories.ts` are the only relevant local contracts.

### 3. Target Files to Create or Modify

**Exactly 4 targets:**

1. Create `apps/admin-web/src/ui/DataTable.tsx`
2. Create `apps/admin-web/src/ui/ListControls.tsx`
3. Create `apps/admin-web/src/ui/data-table.css`
4. Modify `apps/admin-web/src/main.tsx`

### 4. Explicit Contracts & Signatures

`DataTable.tsx` imports `SortSpec` from `../contracts/admin.ts`, primitives from `./primitives.tsx`, and exports:

```ts
export interface Column<T, K extends string> {
  id: string; header: string; cell: (row: T) => React.ReactNode; sortKey?: K;
}
export interface DataTableProps<T, K extends string> {
  caption: string; rows: readonly T[]; columns: readonly Column<T, K>[];
  getRowId: (row: T) => string; sort: SortSpec<K>;
  onSortChange: (sort: SortSpec<K>) => void;
  loading: boolean; error: string | null; onRetry: () => void; emptyTitle: string;
}
export function DataTable<T, K extends string>(props: DataTableProps<T, K>): React.ReactElement;
```

The table never queries a repository or sorts/paginates only the current page locally. It renders supplied rows and emits a new sort specification; first click sorts ascending, repeated click toggles direction, and only columns with `sortKey` are interactive. Use `caption`, `scope="col"`, `aria-sort`, stable row IDs and a horizontally scrollable wrapper; keep error/empty/loading cases distinct.

`ListControls.tsx` imports exact query types from `../contracts/admin.ts`, and `SelectOption`/primitives from `./primitives.tsx`. Export:

```ts
export type FilterId = "capacityBand" | "collectionStatus" | "online" | "status" | "categoryId" | "publication";
export interface FilterField { id: FilterId; label: string; value: string; options: readonly SelectOption[]; }
export interface SearchFilterBarProps {
  search: string; searchLabel: string; onSearchChange: (value: string) => void;
  filters: readonly FilterField[];
  onFilterChange: (id: FilterId, value: string) => void; onReset: () => void;
}
export interface PaginationProps {
  page: number; pageSize: PageSize; total: number;
  onPageChange: (page: number) => void; onPageSizeChange: (size: PageSize) => void;
}
export function SearchFilterBar(props: SearchFilterBarProps): React.ReactElement;
export function Pagination(props: PaginationProps): React.ReactElement;
export function parseBinQuery(params: URLSearchParams): BinListQuery;
export function parseAlertQuery(params: URLSearchParams): AlertListQuery;
export function parseVerificationQuery(params: URLSearchParams): VerificationListQuery;
export function parseRewardQuery(params: URLSearchParams): RewardListQuery;
export function patchQuery(params: URLSearchParams, patch: Record<string, string | null>): URLSearchParams;
```

Exact query-string vocabulary/defaults:

| Parser | Shared keys | Specific keys and defaults |
|---|---|---|
| All four | `search=""`, `page=1`, `pageSize=5`, `sort`, `direction` | Reject invalid numeric/enum query text by reverting to the documented default |
| Bin | `sort=id`, `direction=asc` | `capacityBand=all`, `collectionStatus=all`, `online=all` |
| Alert | `sort=triggeredAt`, `direction=desc` | `status=active`; preserve independent `alertId` selection key |
| Verification | `sort=occurredAt`, `direction=desc` | `status=awaitingReview`; preserve independent `ticketId` selection key |
| Reward | `sort=title`, `direction=asc` | `publication=all`, no `categoryId` means null |

`patchQuery` returns a new URLSearchParams without mutating the input, deletes keys whose patch value is null, and preserves unrelated selection keys. On search/filter/sort/page-size change, patch page to `"1"` in the **same** update. Apply page controls to repository-returned `page`/`total`; Previous/Next disable at their boundaries.

Use no business rows in the temporary preview. In `main.tsx`, render a controlled empty table using `type PreviewRow = { id: string; label: string }`, structural columns for Label, and `rows=[]`; include filters/pagination. Also show a development-only JSON preview of the four parser results from `new URLSearchParams(window.location.search)`, so manual invalid-query checks have an observable result; do not add fake business records.

### 5. Anti-Hallucination Guardrails ("DO NOT" Rules)

- Do NOT import TanStack Table, DataGrid, a pagination package, or a nonexistent `useDebounce` hook.
- Do NOT connect a table to Firestore/onSnapshot or install observable packages; repository observables from Phase 3 are the only live-data seam in this goal.
- Do NOT assume rows have a top-level `id`; bins use `row.bin.id`, alerts `row.alert.id`, reviews `row.ticket.id` through `getRowId`.
- Do NOT accept arbitrary sort keys, cast invalid URL values directly to enums, or sort numbers lexicographically.
- Do NOT create a second filtered copy of repository business data inside the table component.
- Do NOT call React Router hooks in the Phase 5 preview before Phase 6 creates a router; use plain React state and the native URL/history APIs there.
- Do NOT create business screens, edit repositories, or exceed the four target files.

### 6. Step-by-Step Verification Gate

Working directory: `apps/admin-web`.

1. Run `npm run lint`, `npm run check:tests`, `npm test`, and `npm run build` separately.
2. In the temporary preview, verify empty state, sortable header callbacks, controlled search text, filter changes and disabled boundary pagination.
3. Modify preview URL query values manually to invalid page/size/sort/status text; confirm parsers show defaults without crashing.
4. At 390px, the table wrapper may scroll horizontally but the whole page must not overflow. Keyboard controls and `aria-sort` must reflect state.
5. Confirm there are no seeded bin/reward records in `DataTable.tsx`, `ListControls.tsx`, or the preview.
6. Confirm query IDs remain strings, sort dates remain ISO-compatible values, and no Firebase SDK/import/listener or config file was added.

---

## Phase 6 — Standalone admin shell, entry screen and web routing

### 1. Scope & Objective

Replace the temporary preview with an independent admin login and responsive navigation shell. Register the complete route vocabulary without importing screen files that later phases have not created.

### 2. Source Figma Make Files (Read-Only Reference)

- `EcoLoop_AI_Figma_Design_Artifacts/src/App.tsx`: `ResidentSettings` entry button for decoupling context, root `App`, `adminNav`, `AdminApp`, `Brand`.
- `EcoLoop_AI_Figma_Design_Artifacts/src/index.css`: `.admin-shell`, sidebar/header/user/search rules, media queries, `.side-top`, `.sidebar-backdrop`, `.mobile-close`.
- Login/breadcrumbs are bounded extensions of the source design; there is no Figma production-login screen to import.

### 3. Target Files to Create or Modify

**Exactly 5 targets:**

1. Create `apps/admin-web/src/app/router.tsx`
2. Create `apps/admin-web/src/app/AdminShell.tsx`
3. Create `apps/admin-web/src/app/LoginPage.tsx`
4. Create `apps/admin-web/src/app/shell.css`
5. Modify `apps/admin-web/src/main.tsx`

### 4. Explicit Contracts & Signatures

Use only React Router exports from `react-router-dom`: `createBrowserRouter`, `RouterProvider`, `Navigate`, `Outlet`, `NavLink`, `useLocation`, `useNavigate`, `useSearchParams`, `useBlocker`. Use data-router `createBrowserRouter` so dirty-form blocking in Phase 9 is supported; do not wrap it in another BrowserRouter.

`router.tsx` exports:

```ts
export const ADMIN_PATHS: {
  login: "/login"; overview: "/overview"; bins: "/bins";
  alerts: "/alerts"; verification: "/verification";
  vouchers: "/vouchers"; settings: "/settings";
};
export function createAdminRouter(): ReturnType<typeof createBrowserRouter>;
export function AdminRouter(): React.ReactElement;
```

Keep `ProtectedAdminLayout`, `PendingFeaturePage` and `RouteNotFound` private in `router.tsx`. `AdminRouter` owns one stable router instance, not a new router per render. `PendingFeaturePage` takes only `{ title: string }` and displays a clearly labeled not-yet-converted development surface; remove every use in Phases 7–9.

Route table:

| Path | Initial Phase 6 element | Final owner |
|---|---|---|
| `/` | Redirect after session read | `/overview` signed in, `/login` signed out |
| `/login` | `LoginPage` | Public; signed-in users redirect to `/overview` |
| `/overview` | PendingFeaturePage “Overview” | Phase 7 OverviewPage |
| `/bins` | PendingFeaturePage “Smart Bins” | Phase 7 SmartBinsPage |
| `/alerts` | PendingFeaturePage “Capacity Alerts” | Phase 8 CapacityAlertsPage |
| `/verification` | PendingFeaturePage “Deposit Verification” | Phase 8 DepositVerificationPage |
| `/vouchers` | PendingFeaturePage “Rewards & Vouchers” | Phase 9 RewardsVouchersPage |
| `/settings` | PendingFeaturePage “Settings” | Phase 9 SettingsPage |
| `*` | RouteNotFound with safe Home/Login action | Remains |

For protected routes, observe `auth.watchAuthState()` through `useObservableQuery<AuthState>`, show startup loading/error/Retry, then require `isSignedIn && role === "admin"` before rendering AdminShell. Signed-out state navigates with `replace` to Login; a signed-in non-admin claim renders permission-denied/Sign out, never the protected outlet. Claim/UID changes must re-run this guard without changing the mock session ID. Redirect bodies make no async/SDK calls. Preserve a `redirect` query parameter only for a known admin path plus safe query text; never external/protocol-relative URLs. Login's signed-in redirect is suppressed during `intent=logout`.

`AdminShell.tsx` exports `AdminShell(): React.ReactElement`; `LoginPage.tsx` exports `LoginPage(): React.ReactElement`. Both import `services`, `useObservableQuery`, `useMutation` from `./services.ts`, `AuthState` from `../contracts/shared.ts`, and UI primitives from `../ui/primitives.tsx`; neither receives resident props. `useQuery` remains available only if an explicit one-shot preload is actually needed.

Exact sidebar metadata is local structural configuration, not mock entity data:

```ts
const ADMIN_NAV = [
  { path: "/overview", label: "Overview", icon: "grid" },
  { path: "/bins", label: "Smart Bins", icon: "bin" },
  { path: "/alerts", label: "Capacity Alerts", icon: "alert" },
  { path: "/verification", label: "Deposit Verification", icon: "camera" },
  { path: "/vouchers", label: "Rewards & Vouchers", icon: "gift" },
  { path: "/settings", label: "Settings", icon: "settings" }
] as const;
```

Shell behavior:

- Sidebar source widths 244/78, full-height sticky rail; below 700px a 270px focus-managed off-canvas drawer with overlay, Escape and close on route change. Preserve accessible names on compact `NavLink` items with `aria-label` even when visible labels are hidden; do not hide the drawer toggle behind a collapsed rail.
- Header 72px, sticky; derive name/initials from `auth.watchIdentity()` through `useObservableQuery`. Top bell/sidebar badge observe `dashboard.watchSummary()` and use `.activeAlerts`; they link to `/alerts` and react to mock commits without polling or another read beside the subscription.
- Header search is deliberately labeled **Search bins**; submit routes to `/bins?search=<encoded text>&page=1`. Do not advertise unsupported global resident/deposit search.
- Breadcrumbs: `Admin / <current sidebar label>` based on pathname, not arbitrary entity fields. Render `<Outlet />` once; content maximum 1440px.
- Logout first navigates to `/login?intent=logout` without mutating the session; this lets Phase 9's dirty-form blocker ask Stay/Discard before logout commits. Once that navigation is allowed, LoginPage invokes `auth.logout` exactly once, then replaces the URL with `/login`; pending/error/Retry is shown on LoginPage and no signed-in redirect runs during this intent. No resident app link exists; business reads have signed-in enforcement in the mock repository.
- Login uses controlled email/password fields, required/email checks, one busy submit, and inline error. A **Use demo credentials** button awaits `auth.getDemoCredentials` and fills the form; the UI does not embed the seed credentials. Successful login goes to validated `redirect` or `/overview`.
- Show “Standalone admin demo · in-memory data resets on refresh” as interface copy. Login is a mock entry, not a real identity provider.

`main.tsx` now mounts only `<AdminRouter />`, imports fonts/theme/shared component styles, `data-table.css` and `shell.css`, and removes the temporary previews. Do not keep a resident/admin role state.

### 5. Anti-Hallucination Guardrails ("DO NOT" Rules)

- Do NOT import feature pages until their actual files are created in Phases 7–9.
- Do NOT initialize Firebase Auth/App Check, trust an editable profile role, or use a local role-switch button as authorization; only the declared mock AuthState stream drives the admin claim guard now.
- Do NOT copy `switchRole`, embed this app under Flutter Settings, or use the root Flutter `web/index.html`.
- Do NOT create auth contexts, token fields, API URLs, localStorage persistence or a second router.
- Do NOT render fake admin identity text from constants in the shell; use `getIdentity`.
- Do NOT leave header search, bell, mobile drawer close or Logout as no-op buttons.

### 6. Step-by-Step Verification Gate

Working directory: `apps/admin-web`.

1. Run `npm run lint`, `npm run check:tests`, `npm test`, and `npm run build` separately.
2. Open `/bins` signed out → Login; use demo-fill, submit, and verify return to `/bins`. Wrong credentials must show error and retain values.
3. Navigate all six sidebar paths; each must resolve to a named pending screen without missing imports. Unknown path shows RouteNotFound.
4. Check 1440px full sidebar, 800px compact rail, 390px drawer; open/close with mouse, Escape, keyboard and route change.
5. Submit header bin search, click bell, and logout; confirm URL changes correctly and Back cannot display a usable protected screen while signed out.
6. Refresh a protected URL; the in-memory session resets, the HTML fallback loads, and Login appears. Record that deployment will require SPA fallback to `index.html`.
7. Verify initial/login/logout AuthState emissions and the mocked non-admin claim gate; no Auth SDK calls occur. Document Firebase Hosting `dist` + `/index.html` SPA rewrite for Goal 4 only; do not run Firebase CLI or create Hosting config now.

---

## Phase 7 — Fleet visibility: Overview, then Smart Bins CRUD

### 1. Scope & Objective

Convert Overview and Smart Bins as the paired fleet-visibility feature while retaining separate routes. Build the read-only dashboard first, then add validated bin CRUD using the existing repository and shared table contracts.

### 2. Source Figma Make Files (Read-Only Reference)

- `EcoLoop_AI_Figma_Design_Artifacts/src/App.tsx`: `Overview`, `BinTable`, `Bins`, `AdminTitle`.
- `EcoLoop_AI_Figma_Design_Artifacts/src/index.css`: `.metric-grid`, `.metric`, `.dashboard-grid`, `.panel`, `.chart`, `.bars`, `.donut`, `.legend`, `.table-wrap`, `.capacity`, `.alert-banner`.
- Read completed UI/repository contracts only; do not reread unrelated resident flows.

### 3. Target Files to Create or Modify

**Exactly 4 targets:**

1. Create `apps/admin-web/src/features/fleet/OverviewPage.tsx`
2. Create `apps/admin-web/src/features/fleet/SmartBinsPage.tsx`
3. Create `apps/admin-web/src/features/fleet/fleet.css`
4. Modify `apps/admin-web/src/app/router.tsx`

### 4. Explicit Contracts & Signatures

Export `OverviewPage(): React.ReactElement` and `SmartBinsPage(): React.ReactElement` as named exports. Both screens import `services`, `useObservableQuery`, `useMutation` from `../../app/services.ts`; types from `../../contracts/shared.ts`/`admin.ts`; UI from `../../ui/primitives.tsx`, `../../ui/DataTable.tsx`, `../../ui/ListControls.tsx`, `../../ui/Modal.tsx`; and `./fleet.css`. Standard async CRUD remains on services.repositories; no new screen props/models are introduced.

The router adds only `../features/fleet/OverviewPage.tsx` and `../features/fleet/SmartBinsPage.tsx` imports, replacing those two pending elements. Keep the other four pending routes intact.

#### First task: Overview

- Query key `"dashboard"`, source `() => services.repositories.dashboard.watchSummary()` passed to `useObservableQuery`.
- Four structural KPI labels bind only to `registeredBins`, `activeAlerts`, `verifiedDeposits`, `ecoPointsIssued`; no source numeric constants.
- Build CSS/SVG bars from `activity[].date` and `activity[].verifiedDepositCount`. Scale y-axis to at least 1; use local calendar labels via `Intl.DateTimeFormat("en-MY", { timeZone: "Asia/Kuala_Lumpur", weekday: "short" })`.
- Build donut from `materialMix[].weightKg`; derive percentages over `totalWeightKg`, include a labeled legend/table, and render a real zero-total state. Material colors map structural enum values to theme variables.
- Attention table uses `summary.attentionBins`, `getRowId: row => row.bin.id`, and columns Bin ID / Location / Capacity / Status / Collection. It must not re-read a hardcoded BinTable array.
- Simulate button calls `bins.simulateCapacity("BIN-004", 85)`; this is an explicit demo action referencing a defined fixture ID, not a new fake row. Disable while pending; errors use Feedback; store revision reloads dashboard/shell badge.
- Alert banner appears when `activeAlerts > 0`, links `/alerts`, and describes the count rather than assuming BIN-004 is the only possible active bin.
- Private render helpers stay inside `OverviewPage.tsx`: `formatPoints(value: number): string`, `formatWeight(value: number): string`, `capacityBand(value: number): CapacityBand`. No new helper file.

Run the phase commands after finishing Overview before beginning the bins screen.

#### Second task: Smart Bins

Use `parseBinQuery(useSearchParams()[0])`; query key is `"bins:" + params.toString()`. Source is `() => services.repositories.bins.watchList(query)` through `useObservableQuery`; columns have type `Column<SmartBinRow, BinSortKey>[]`. Promise `bins.list` stays available for explicit reads but is not run in parallel with that live subscription.

| Column ID | Cell fields | Sort key |
|---|---|---|
| `id` | `row.bin.id` | `id` |
| `location` | `row.bin.locationName`, `row.bin.locationDetail` | `locationName` |
| `capacity` | `row.bin.capacityPercent`, themed progress bar | `capacityPercent` |
| `status` | Derived capacity band + online indicator | None |
| `collection` | `row.operations.collectionStatus` mapped to display text | None |
| `actions` | Edit / Delete | None |

Filters: capacityBand all/normal/warning/critical; collectionStatus all/notScheduled/pending/scheduled/collected; online all/online/offline. All filters and sort/page/search update the URL atomically with `patchQuery`; normalize repository-returned page once if it was clamped.

Define only these form types locally:

```ts
type BinFormErrors = Partial<Record<"id" | "locationName" | "locationDetail" |
  "capacityPercent" | "acceptedMaterials", string>>;
interface BinFormState {
  id: string; locationName: string; locationDetail: string;
  capacityPercent: string; acceptedMaterials: MaterialType[]; isOnline: boolean;
}
```

New bin form opens with empty ID/location strings, capacity `"0"`, no accepted materials and online true. Editing populates from `row.bin`, keeps ID immutable, and converts the capacity string to an integer only after validation. Material checkboxes are structural options plastic/aluminium/paper/glass with display labels; do not offer unknown.

Validate the same rules as the repository. Save calls `bins.create(form.id, input)` or `bins.update(originalId, input)` with exactly `BinInput` fields; no `lastUpdatedAt` write prop. Delete opens ConfirmDialog and calls `bins.delete(id)`; show referenced-record conflict without removing the row. Cancel resets the draft; failed saves retain values; successful writes close the modal and refetch through revision.

### 5. Anti-Hallucination Guardrails ("DO NOT" Rules)

- Do NOT copy the source's 24/1,284/18,450 KPI constants or chart-height percentages.
- Do NOT import Firestore snapshots/SDK objects, invent integer primary keys, connect Firebase listeners, or edit protected Android configs; use string IDs and mock observables/CRUD only.
- Do NOT access `row.id`, `row.location`, `row.capacity` or `row.status` on `SmartBinRow`.
- Do NOT write collection state through `BinInput`, delete referenced bins, or mutate a returned row directly.
- Do NOT create chart/bin-table/form helper files, add packages, or modify repositories/contracts.
- Do NOT replace more than the Overview/Bins route elements in this phase.

### 6. Step-by-Step Verification Gate

Working directory: `apps/admin-web`; run commands after each screen, not only after the pair.

1. Run `npm run lint`, `npm run check:tests`, `npm test`, and `npm run build` separately.
2. Login → Overview: confirm baseline 5/0/12/150, material total 1.04 kg derived from item counts, seven real dates, and attention bins from data. Simulate 85 → count/badge/banner update without reload.
3. Bins: search Cedar, apply capacity+collection+online filters together, sort capacity numerically, switch page size and verify URL/direct refresh semantics.
4. Create BIN-020 with valid data → appears; edit its location → persists across routes; delete → disappears. Try duplicate BIN-004, negative/101 capacity, no materials, and deleting BIN-004; all must show errors without partial changes.
5. Check table scrolling, charts and CRUD modal at 390/800/1440 widths; verify loading, no-match empty state, busy buttons and error display.
6. Verify a committed mock change updates both the list and dashboard subscriptions, switching query keys detaches old listeners, and navigation does not duplicate subscriptions or Firebase requests.

---

## Phase 8 — Operations workflow: Capacity Alerts, then Deposit Verification

### 1. Scope & Objective

Convert the collection-alert workflow and the review queue into two dedicated operational screens. Drive their transitions exclusively through the mock repositories so bin resets and resident point credits remain consistent with shared domain records.

### 2. Source Figma Make Files (Read-Only Reference)

- `EcoLoop_AI_Figma_Design_Artifacts/src/App.tsx`: `Alerts`, `Verification`, `AdminApp` collection/review callbacks.
- `EcoLoop_AI_Figma_Design_Artifacts/src/index.css`: `.workflow`, `.tabs`, `.alert-detail`, `.alert-facts`, `.alert-actions`, `.resolution`, `.review-layout`, `.review-list`, `.review-detail`, `.camera-shot`, `.classification`.
- Keep the review list accessible on small screens even though the source hides it; use stacked layout or a list/detail toggle.

### 3. Target Files to Create or Modify

**Exactly 4 targets:**

1. Create `apps/admin-web/src/features/operations/CapacityAlertsPage.tsx`
2. Create `apps/admin-web/src/features/operations/DepositVerificationPage.tsx`
3. Create `apps/admin-web/src/features/operations/operations.css`
4. Modify `apps/admin-web/src/app/router.tsx`

### 4. Explicit Contracts & Signatures

Export `CapacityAlertsPage(): React.ReactElement` and `DepositVerificationPage(): React.ReactElement`. Import the same shared UI/services modules as Phase 7, using `../../` paths, and import `./operations.css`; the router imports the two new page modules under `../features/operations/`.

#### First task: Capacity Alerts

Observe `alerts.watchList(parseAlertQuery(params))` through `useObservableQuery` under key `"alerts:" + params.toString()`. Read optional `alertId`; if supplied, observe `alerts.watch(alertId)`, otherwise select the first row. Detail observation is independent of the visible page, so direct-link selection never depends on finding an ID in page 1; null detail is explicit not-found.

Keep a private same-file `AlertDetailPanel(props: { alertId: string; onResolved: (id: string) => void }): React.ReactElement`. Mount only after an ID is known, keyed by it; its unconditional `useObservableQuery` subscribes to `alerts.watch(props.alertId)`. Do not invent an `enabled` option or call hooks conditionally; cleanup cancels the old ID's observation.

Bind only these paths:

| Display | Exact value |
|---|---|
| Alert ID/status/time/threshold | `row.alert.id`, `.status`, `.triggeredAt`, `.thresholdPercent` |
| Bin/location/capacity/update | `row.bin.id`, `.locationName`, `.locationDetail`, `.capacityPercent`, `.lastUpdatedAt` |
| Collection lifecycle | `row.operations.collectionStatus` |
| Tab counts | `AlertPage.activeCount`, `AlertPage.resolvedCount` |

Tabs set status active/resolved and page 1. Five workflow steps use the alert's threshold snapshot in the first label rather than hardcoded 85; indicate trigger/created/scheduled/collected/resolved from actual state. Actions are:

- `alerts.schedule(alert.id)` only for active pending/notScheduled.
- `alerts.collect(alert.id)` only for active scheduled, with ConfirmDialog describing reset to 10%.
- `alerts.resolve(alert.id)` only for active collected; on success set URL status resolved and alertId in the same patch.
- Demo simulate uses `bins.simulateCapacity("BIN-004", 85)` even when the active list is empty.

Busy state blocks duplicate actions; all writes refresh the shell/dashboard/bin lists via the existing revision. Empty active/resolved lists show distinct copy; missing selected ID shows recoverable not-found and a Clear selection action. Do not reset capacity in a component before the repository resolves.

Run the phase commands before starting Verification.

#### Second task: Deposit Verification

Observe `verification.watchList(parseVerificationQuery(params))` through `useObservableQuery` with `"verification:" + params.toString()`. Read independent string `ticketId`; observe `verification.watch(id)` for selected detail. Queue labels use `detail.transaction.id`, bin ID, occurredAt, `detail.ticket.flag`, and `.confidencePercent`. Detail null means not-found, and `captureImageUrl` remains a nullable download URL string, never a Firebase Storage task/reference.

When selecting the initial first ticket, normalize its ID into `ticketId` once with a replace-style query update. Keep that explicit selected ID after a decision so a refreshing awaiting-review list cannot switch the detail panel to another resident or erase the just-completed result banner.

Keep a private same-file `VerificationDetailPanel(props: { ticketId: string }): React.ReactElement`, mounted and keyed only when a selected ID exists. It owns the detail query and confirmation state, so changing the selected ticket resets that draft without conditional hooks or an invented query-hook option.

The split detail binds only:

- Camera placeholder/image: `ticket.captureImageUrl` and `ticket.captureDescription`.
- Predicted material: `ticket.predictedMaterialLabel`.
- Confidence: `ticket.confidencePercent`.
- Masked resident reference derived from `resident.id`; do not mutate the ID in storage.
- Points status from `transaction.status`/`pointsAwarded`, not a separate `reviewed` string state.
- Decision metadata from `ticket.status`, `reviewedAt`, `reviewedByAdminId`.

Private UI state is exactly `decision: "approve" | "reject" | null` plus `idempotencyKey: string | null`. When opening decision confirmation, create one key via `crypto.randomUUID()` and keep it until success/cancel; a retry reuses it. Confirm calls `verification.decide(ticket.id, decision, idempotencyKey)`; after success, keep the finalized detail available and show a decision banner even if it disappears from the awaitingReview queue.

Queue status tabs are awaitingReview/approved/rejected, with search and pagination. Disable review actions on finalized tickets and show a recoverable failure if another action already finalized the record. The default REV-1087 approval must update Faris's existing pending Paper record, not insert a new unrelated deposit or credit another resident.

### 5. Anti-Hallucination Guardrails ("DO NOT" Rules)

- Do NOT treat an alert as resolved merely because capacity is below threshold after collection.
- Do NOT call live Firebase/Storage SDKs for snapshots or camera images, store numeric owner IDs, or put joined VerificationDetail/decision receipts into a document writer.
- Do NOT use `Approved` as a `DepositStatus`, add a confidence field to `DepositTransaction`, or conflate ticket ID REV-1087 with transaction ID DEP-1087.
- Do NOT award 20 points in UI arithmetic or implement approve/reject by toggling one shared string.
- Do NOT regenerate an idempotency key on a failed-write retry or re-enable finalized decision actions.
- Do NOT create new screen/helper files, admin logs/user pages, packages or API calls.

### 6. Step-by-Step Verification Gate

Working directory: `apps/admin-web`; check after each screen.

1. Run `npm run lint`, `npm run check:tests`, `npm test`, and `npm run build` separately.
2. Fresh session: simulate BIN-004 85 → alert → Schedule → confirm Collect (10%) → Resolve. Active count becomes 0, resolved 1; Overview/Bins/header agree.
3. Verification: both queue items are selectable; approve REV-1087, verify 4 pcs paper and +12 pts with finalized metadata. Navigate away/back; it must not credit twice. Reject REV-1081; its points are 0 and no wallet credit is reported.
4. Change queue status/search, exercise pagination, open `/verification?ticketId=REV-1087`, and test unknown IDs; selected details must not depend on row indexes.
5. On a fresh seed, check mobile list/detail access at 390px, all confirmation keyboard behavior, empty queues after decisions, and source-style workflow/review layouts at desktop widths.
6. Observe the selected UID's wallet/snapshot in repository tests while deciding: only committed credit emits, retry cannot double-credit, unsubscribe stops events, and all URL/UID fields stay string/null without Firebase calls.

---

## Phase 9 — Program controls: Rewards & Vouchers CRUD, then Settings

### 1. Scope & Objective

Convert the catalog-management and configuration screens into validated editable forms backed by the mock repositories. Preserve the shared Reward and MaterialRate contracts so future admin changes can feed the resident app through the same database.

### 2. Source Figma Make Files (Read-Only Reference)

- `EcoLoop_AI_Figma_Design_Artifacts/src/App.tsx`: `AdminVouchers`, source `Voucher` alias, `AdminSettings`, resident `Rewards`/`RecycleGuide` for the shared meaning of catalog/rates.
- `EcoLoop_AI_Figma_Design_Artifacts/src/index.css`: `.voucher-form`, `.table-action`, `.settings-stack`, `.setting-section`, `.material-options`, `.rate-options`, `.success-banner`.
- The source's `Voucher` alias is **not** a type to copy; use the complete shared `Reward` declaration from Phase 2.

### 3. Target Files to Create or Modify

**Exactly 4 targets:**

1. Create `apps/admin-web/src/features/program/RewardsVouchersPage.tsx`
2. Create `apps/admin-web/src/features/program/SettingsPage.tsx`
3. Create `apps/admin-web/src/features/program/program.css`
4. Modify `apps/admin-web/src/app/router.tsx`

### 4. Explicit Contracts & Signatures

Export `RewardsVouchersPage(): React.ReactElement` and `SettingsPage(): React.ReactElement`. Import services/UI/contracts using the same `../../` paths as previous feature phases; import `./program.css`. Replace only `/vouchers` and `/settings` pending route elements; remove the now-unused PendingFeaturePage from router.tsx.

#### First task: Rewards & Vouchers

Observe `rewards.watchList(parseRewardQuery(params))` and `rewards.watchCategories()` via `useObservableQuery`. Keep Promise reads for edit preloads. URL remains `/vouchers`, but the table edits flat `RewardDocument` values through `RewardInput`, presented as enriched `Reward` read models; it never edits `ResidentVoucher` or the computed resident count.

Columns are `title`, `pointsCost`, `expiresAt`, derived publication, and actions. Use `Column<Reward, RewardSortKey>[]`, row key `reward.id`; title/cost/expiry are sortable. Publication text is Active if `isActive`, otherwise Draft; expired items may show a separate expiry notice without a new persisted status.

Exact local form contracts:

```ts
interface RewardFormState {
  title: string; description: string; merchantName: string;
  categoryId: string; tag: string; imageUrl: string; pointsCost: string; expiresOn: string;
  isActive: boolean; maxRedemptionsPerResident: string;
  artKey: string; sortOrder: string;
}
type RewardFormField = keyof RewardFormState;
type RewardFormErrors = Partial<Record<RewardFormField, string>>;
```

Create opens with empty text/cost/expiry/category/imageUrl, max `"1"`, artKey `"art0"`, sortOrder `"0"`, isActive false. Category options come from the category observable, not a duplicate list. Validate all repository rules; blank tag/imageUrl becomes null, nonblank imageUrl must be HTTPS text. It is a URL field only, not an upload action in Goal 2. `expiresOn` is `YYYY-MM-DD`, converted to `${expiresOn}T23:59:59+08:00`, never locale-dependent date parsing.

- Create calls `rewards.create(input)` with the exact `RewardInput` fields; new IDs/counts are repository-managed.
- Edit calls `rewards.update(id, input)`; load current full record before populating the form.
- Set draft/active uses `rewards.update` with a full validated input reconstructed from the existing record, excluding `id` and `residentRedemptionCount`. Do not submit a partial `{isActive}` to a full-input method.
- Delete uses ConfirmDialog then `rewards.delete(id)`; referenced-record conflict remains visible in the dialog.
- Success closes/resets forms and shows feedback; failure retains draft/selection. Query category/publication filters AND with search; URL sort/pagination is shared.
- New drafts do not enter the resident active catalog. Catalog CRUD must not create an issued voucher, debit a wallet, or edit an existing voucher code.

Run the phase commands before starting Settings.

#### Second task: Settings

Observe `settings.watch()` through `useObservableQuery` under `"settings"`; copy its three editable fields into local draft once per initial load/save, preserving a dirty draft across new snapshots. AdminSettings is a composed response; `settings.update` splits ProgramSettingsDocument and flat MaterialRate records atomically inside the repository rather than writing the aggregate to Firestore.

Use local state:

```ts
interface SettingsFormState {
  capacityAlertThreshold: "75" | "80" | "85";
  acceptedMaterials: MaterialType[];
  rateInputs: Record<"plastic" | "aluminium" | "paper" | "glass", string>;
}
type SettingsFormErrors = Partial<Record<"capacityAlertThreshold" | "acceptedMaterials" |
  "plastic" | "aluminium" | "paper" | "glass", string>>;
```

The rate section iterates `AdminSettings.materialRates` in repository order, preserving `materialType` and `displayName` and mapping edited integer strings to `pointsPerItem`; `eligible` matches selected accepted materials. Threshold options 75/80/85 are structural enum choices. Save calls `settings.update(input: SettingsInput)`; input does **not** include `id` or `updatedAt`.

Validate accepted materials nonempty, exact four distinct rates, integer 0–1000 values and valid threshold before submission. Disable repeated saves, show field-level errors and a source-style success banner; failed writes preserve the draft. Cancel restores the last successfully fetched/saved state.

Call `useBlocker(dirty && !pending)` unconditionally from `react-router-dom` and use ConfirmDialog for in-app navigation; attach/clean up `beforeunload` only while dirty. Confirm discard proceeds with the blocked navigation; Stay resets the blocker. Logout and sidebar navigation must pass through this data-router navigation behavior, using Phase 6's navigation-before-logout protocol.

After Save, future verification uses the new accepted materials/rates and future threshold checks use the new threshold. Historical credited transactions do not change. There is no resident notification/preferences setting on this admin page.

### 5. Anti-Hallucination Guardrails ("DO NOT" Rules)

- Do NOT create `{name,points,expiry,status}` objects or change `Reward`/`ResidentVoucher` interfaces.
- Do NOT upload files/call Firebase SDKs, persist AdminSettings/read projections wholesale, or add Firebase Hosting/App Check configuration; this phase uses mock watch/CRUD methods and nullable URL strings only.
- Do NOT store an admin display string Active/Draft in `VoucherStatus` or add a publication enum to `Reward`.
- Do NOT assume Update accepts partial objects; pass a complete `RewardInput`/`SettingsInput`.
- Do NOT key rates by `Metal`/`Plastic` display text; key them by exact MaterialType wire values.
- Do NOT replace a dirty settings form on background refresh or show success before the Promise resolves.
- Do NOT add a Logs/User Management route, packages, backend endpoints or unlisted helper files.

### 6. Step-by-Step Verification Gate

Working directory: `apps/admin-web`; check after each screen.

1. Run `npm run lint`, `npm run check:tests`, `npm test`, and `npm run build` separately.
2. Create a valid draft reward, filter Draft, edit its title/cost/date, activate, find it under Active, delete and confirm removal. Validate blank title, noninteger/negative cost, unknown category and past expiry failures.
3. Settings: change threshold to 75, toggle material acceptance and change paper rate; Save, navigate away/back, confirm saved values. Cancel a draft and exercise dirty-navigation Stay/Discard.
4. Set paper rate to 10 on fresh state, approve existing REV-1087; award must be `4 pcs × 10 pts = 40` and Faris wallet 285, while older credited transactions stay unchanged. Verify the screen result here; the repository variant was required in Phase 3 and the browser variant is required in Phase 10. Do not edit an unlisted test file in this phase.
5. Verify all six routes now render implemented screens, no PendingFeaturePage references remain, and forms/table actions fit 390/800/1440 widths.
6. Confirm saved mock rule/catalog changes emit across observable readers, stored rows stay flat, computed counts/nextRewardCost are omitted, and imageUrl is null/HTTPS text without live uploads or SDK initialization.

---

## Phase 10 — Final async/state wiring audit and integration acceptance

### 1. Scope & Objective

Audit the shared query/mutation and table layers against all completed screens, then execute repeatable end-to-end admin journeys. Record the standalone UI's actual results and backend handoff without expanding the model or screen scope.

### 2. Source Figma Make Files (Read-Only Reference)

- `EcoLoop_AI_Figma_Design_Artifacts/src/App.tsx`: all admin symbols from `adminNav` through `AdminSettings`, plus shared visual helpers.
- `EcoLoop_AI_Figma_Design_Artifacts/src/index.css`: shared/admin styles and final responsive overrides.
- Compare resident/shared domain names with `docs/FIGMA_USER_APP_TO_FLUTTER_IMPLEMENTATION_PLAN.md`; do not edit that plan.

### 3. Target Files to Create or Modify

**Exactly 5 targets:**

1. Modify `apps/admin-web/src/app/services.ts`
2. Modify `apps/admin-web/src/ui/DataTable.tsx`
3. Create `apps/admin-web/tests/admin.e2e.spec.ts`
4. Create `apps/admin-web/playwright.config.ts`
5. Create `docs/ADMIN_WEB_ACCEPTANCE.md`

### 4. Explicit Contracts & Signatures

No new model, repository method, UI prop or route is introduced. Preserve `services`, `useRepositoryRevision`, `useQuery`, `useObservableQuery`, `useMutation`, `DataTableProps` and `Column` signatures; only fix lifecycle/interaction behavior inside those modules. The shared document/URL/AuthState/Observable contracts from Phases 2–3 remain exact and no Firebase adapter is implemented here.

Final state contract:

| Situation | Required result |
|---|---|
| Initial query | Data null, loading true, no stale “empty” flash |
| Initial query failure | Error with Retry; no fabricated successful dataset |
| Empty successful list | Empty message; search/filter controls remain usable |
| Refresh | Keep previous data, refreshing true; no disabled whole-page overlay |
| Rapid query-key changes | Old response ignored; newest URL filters win |
| Successful write | Exactly one store revision notification and coherent affected reads |
| Failed write | No partial mutation; error visible; draft/selection retained |
| Pending mutation | Trigger/confirmation disabled; no duplicate request |
| Unmount | Listeners disposed; late query results ignored |
| Auth UID/claim change | Guard reacts to AuthState; private subscriptions/data are cleared for logout or non-admin roles |
| Observable change | Delayed initial event, committed live updates, no revision-based duplicate read and no event after unsubscribe |
| Sorting | Header emits typed key/direction; repository sorts full filtered set before paging |
| Page deletion/filter shrink | Canonical page clamped once, no navigation/render loop |

Create this configuration in `playwright.config.ts`:

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "admin.e2e.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:5174",
    browserName: "chromium",
    viewport: { width: 1440, height: 1000 }
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:5174",
    reuseExistingServer: !process.env.CI
  }
});
```

Tests import `test`/`expect` from `@playwright/test`; prefer role/label selectors and the exact interface copy in this plan. Every test begins with a new page/full navigation, uses demo-fill/login, and therefore receives a fresh seed; do not reload in the middle of a process-lifetime CRUD journey. No `waitForTimeout` sleeps: wait on UI conditions/locators.

Required test cases:

1. **Entry/routes:** protected URL → Login → demo-fill → requested destination; all six routes and breadcrumbs; unknown route recovery; Logout blocks access.
2. **Fleet CRUD:** create BIN-020 → search + capacity/online filters → numeric sort → edit → delete; invalid form and referenced-delete conflict preserve data.
3. **Alert lifecycle:** simulate 85 → sidebar/header/dashboard count 1 → schedule → collect resets 10 → resolve → count 0; revisiting does not recreate/reset again.
4. **Moderation:** select REV-1087 and approve once → verified result/4 pcs/+12 pts; navigate/reopen and verify no repeat action. Reject REV-1081 → zero credit; queue tabs reflect decisions.
5. **Catalog CRUD:** create/edit/activate/delete draft; filter/search/sort/page-size state follows URL; errors retain form values.
6. **Settings effect:** paper rate 10 → Save → approve REV-1087 → +40; dirty form Stay/Discard; saved values survive route changes.
7. **Responsive:** 390×844 drawer open/close, table local horizontal scroll, accessible review queue, modal focus and keyboard dismissal.

Unit-level named read/write failure, rollback, idempotency, all watch APIs/unsubscribe behavior, UID/claim transitions, flat document maps, Timestamp conversion and URL/shared JSON checks remain in `tests/contracts.test.ts` from Phases 2–3. UI failure states must also be inspected by `services.controls.failNext` only in a temporary debugger expression while paused in services; simulate claim changes similarly with `services.controls.setAuthState`. Do not add production test buttons, globals or endpoints.

`docs/ADMIN_WEB_ACCEPTANCE.md` records command outcomes, all routes/viewports, mock reset behavior, shared document/model parity and unavailable checks. The Goal 3–4 handoff must name one shared Firebase project: Firestore paths and Timestamp converters, Auth UID + user/admin claims, HTTPS Storage download URLs, App Check, and Firebase Hosting dist/SPA rewrites. Defer actual SDK initialization, Firebase rules/indexes/authorization, trusted atomic moderation/redemption, telemetry, uploads and Hosting deployment; record preserved Android configs and live-stream adapter/unsubscribe mappings.

### 5. Anti-Hallucination Guardrails ("DO NOT" Rules)

- Do NOT add new routes, repository methods, query libraries, component props or shared model fields.
- Do NOT initialize/call/deploy Firebase or connect emulators in this final UI gate; prove all scenarios run from the in-memory mocks and preserve all three Android Firebase configs.
- Do NOT hide integration failures with casts, skipped tests, arbitrary sleeps, hardcoded UI rows or weakened validation.
- Do NOT edit a screen outside this five-file budget; report the exact failing screen and request a bounded repair phase if necessary.
- Do NOT claim the browser test ran if the browser binary/target was unavailable.
- Do NOT claim the admin and resident mocks share live data or that Goal 3 backend/database work is complete.

### 6. Step-by-Step Verification Gate

Working directory: `apps/admin-web`, except documentation inspection at repository root.

1. Run `npm ci` to verify the unchanged lockfile and dependency reproducibility.
2. Run `npm run lint`, `npm run check:tests`, `npm test`, and `npm run build` separately.
3. Run `npm run check -- playwright.config.ts tests/admin.e2e.spec.ts` to typecheck the E2E/config modules with the same compiler options.
4. Run `npx playwright install chromium`, then `npm run test:e2e`. The supplied configuration uses Chromium directly and does not define a project named chromium; do not invent a `--project` flag.
5. Manually compare the six desktop screens with Figma at 1440px, and review at 800px/390px/200% zoom. Verify interactive controls, actual async states, dialogs, keyboard focus, table overflow and dynamic chart/count updates.
6. Build preview with `npm run preview`; confirm the deployed-site assumption of SPA `index.html` fallback and refresh-to-demo-login is documented. The site must render fonts/icons and perform all mock CRUD without a backend or runtime external font requests.
7. Inspect `git status --short` from the repository root and verify no source artifact, Flutter source, root Flutter config or existing plan was modified. Write actual results and any blocked checks in `docs/ADMIN_WEB_ACCEPTANCE.md`.
8. Verify all 10 phases kept their 3–5-file budget and six required sections. Confirm no Firebase package/config/SDK call or deployment was added, URL/document/UID schemas match the revised Flutter plan, and observable cleanup/claim-denial checks passed; browser requests must remain local preview assets only.

---

## Completion definition

The goal is complete when all ten phase gates pass, all six screens work through transactional in-memory CRUD/observables, shared Firestore-ready document/UID/URL contracts match Flutter, protected configuration is untouched and acceptance contains real results. Goals 3–4 replace mocks with the **same Firebase project's Firestore/Auth/Storage/App Check adapters and Firebase Hosting deployment**; no live Firebase initialization/call occurs in Goals 1–2.
