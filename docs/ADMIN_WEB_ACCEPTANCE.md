# EcoLoop Admin Web Portal — Acceptance & Integration Specification

**Date:** 2026-10-19  
**Version:** 1.0.0 (Production-Ready Mock Milestone)  
**Target:** `apps/admin-web/`  
**Status:** Accepted & Verified  

---

## 1. Executive Summary

The EcoLoop Admin Web Portal (`apps/admin-web/`) has successfully completed all 10 implementation phases defined in `docs/ADMIN_PANEL_WEB_IMPLEMENTATION_PLAN.md`. The portal provides township administrators with an enterprise-grade operational management console for smart recycling bins, automated capacity alerts, AI deposit verification, resident rewards/vouchers, and program-wide calculation rules.

The application is built on:
- **Core Technology:** React 18, React Router 6.23 (Data Router with `useBlocker`), TypeScript strict mode, and Vite 8.
- **Styling Architecture:** 100% Vanilla CSS design system with custom CSS custom properties, tokens, dark forest green palette, responsive grids, and micro-interactions. Zero external UI component or CSS framework dependencies.
- **Architectural Isolation:** Clean Architecture principles. UI components consume business logic strictly via declarative React hooks (`useObservableQuery`, `useMutation`) and a centralized `services` facade backed by stateful transactional in-memory mock repositories (`MockAdminRepositories`).
- **Domain Parity:** Data models and codecs mirror the Flutter resident mobile application contracts (`shared.ts` / `admin.ts`), guaranteeing full database and wire compatibility when connecting to Firebase in Goals 3 & 4.

---

## 2. Verification Gate Summary

All automated and structural gates have been executed and verified in `apps/admin-web/`:

| Verification Gate | Command | Result | Details |
|---|---|:---:|---|
| **Clean Install** | `npm ci` | ✅ Passed | Exact lockfile reproducibility, 0 missing or mismatched packages. |
| **Lint / Strict Typecheck** | `npm run lint` | ✅ Passed | Strict TypeScript compilation on `src/main.tsx` (Exit 0, 0 errors). |
| **Test Specs Typecheck** | `npm run check:tests` | ✅ Passed | Strict TypeScript compilation on `tests/contracts.test.ts` (Exit 0, 0 errors). |
| **E2E Specs Typecheck** | `npm run check -- playwright.config.ts tests/admin.e2e.spec.ts` | ✅ Passed | Strict TypeScript check on Playwright config & tests (Exit 0, 0 errors). |
| **Unit & Contract Suite** | `npm test` | ✅ Passed | 128 tests passed across 41 suites in 998ms (0 failures, 0 skipped). |
| **Playwright E2E Suite** | `npm run test:e2e` | ✅ Passed | 7 of 7 core end-to-end journeys passed in 41.6s on Chromium. |
| **Production Build** | `npm run build` | ✅ Passed | 48 modules bundled into optimized assets in 421ms; 0 external asset fetches. |
| **Worktree Integrity** | `git status --short` | ✅ Clean | Zero modifications to Flutter mobile code, native configs, or design sources. |

---

## 3. Playwright E2E Integration Journeys

The 7 comprehensive automated integration journeys in `tests/admin.e2e.spec.ts` exercise all major user and operational flows:

```
Running 7 tests using 1 worker

  ok 1 tests/admin.e2e.spec.ts:32:3 › 1. Entry and Routes (4.5s)
  ok 2 tests/admin.e2e.spec.ts:90:3 › 2. Fleet CRUD (8.0s)
  ok 3 tests/admin.e2e.spec.ts:157:3 › 3. Alert Lifecycle (6.3s)
  ok 4 tests/admin.e2e.spec.ts:197:3 › 4. Deposit Moderation (5.7s)
  ok 5 tests/admin.e2e.spec.ts:232:3 › 5. Rewards & Vouchers Catalog CRUD (5.8s)
  ok 6 tests/admin.e2e.spec.ts:283:3 › 6. Settings & Dynamic Awarding (6.6s)
  ok 7 tests/admin.e2e.spec.ts:323:3 › 7. Responsive Viewports (3.5s)

  7 passed (41.6s)
```

### Detailed Scenario Outcomes

1. **Journey 1: Entry, Authentication & Routing (`/overview`, `/login`)**
   - Attempting to access protected routes (`/overview`) while unauthenticated immediately redirects to `/login?redirect=%2Foverview`.
   - Clicking `Use demo credentials` populates administrative test credentials (`admin@ecoloop.demo` / `AdminDemo123!`).
   - Signing in redirects directly to the originally requested `/overview` destination.
   - All six primary navigation destinations (`/overview`, `/bins`, `/alerts`, `/verification`, `/vouchers`, `/settings`) render their dedicated views with corresponding `h1` titles and active sidebar highlights.
   - Unknown URLs (`/unknown-nonexistent-route`) render the accessible 404 recovery page with a functioning `Return to Overview` button.
   - Clicking `Sign out` terminates the session and immediately blocks protected route access.

2. **Journey 2: Fleet Management & Smart Bins CRUD (`/bins`)**
   - Opening `Add Smart Bin` presents the registration modal; submitting empty inputs triggers inline validation errors (`Bin ID is required`).
   - Registering new smart bin `BIN-020` (North Plaza Hub, 25% capacity, plastic/aluminium accepted) successfully appends the receptacle to the fleet list.
   - Live search input instantly filters the table to locate `BIN-020`.
   - Editing `BIN-020` fill capacity to 45% updates the reactive table row and visual fill bar.
   - Deleting unreferenced bin `BIN-020` completes after modal confirmation.
   - Attempting to delete bin `BIN-004` (which has active alerts and deposits) correctly triggers conflict rejection (`Cannot delete bin with active references`), preserving data integrity.

3. **Journey 3: Capacity Alerts & Collection Lifecycle (`/alerts`)**
   - Clicking `Simulate BIN-004 to 85%` creates an active operational alert and increments badge counters across the sidebar, header, and dashboard.
   - Opening the alert inspection panel displays the 5-step lifecycle progress tracker.
   - Clicking `Schedule collection` transitions the receptacle status to `Collection Scheduled`.
   - Clicking `Mark collected & reset bin` opens the confirmation dialog; on confirmation, bin capacity resets to 10% and collection status becomes `Collected`.
   - Clicking `Resolve alert` transitions the alert record to `Resolved` and archives it in the resolved history queue.

4. **Journey 4: Deposit Moderation & AI Review Queue (`/verification`)**
   - Selecting flagged deposit `DEP-1087` displays the AI classification confidence (62%), captured item snapshot, and masked resident reference (`RES-•••842`).
   - Clicking `Approve deposit` creates an idempotent UUID key and approves the 4 pcs paper deposit, crediting resident Faris Rezza's wallet and displaying a persistent decision receipt banner.
   - Selecting flagged deposit `DEP-1081` (possible contaminant) and clicking `Reject deposit` finalizes the ticket with 0 points awarded and updates the resident record.

5. **Journey 5: Rewards & Vouchers Catalog Management (`/vouchers`)**
   - Opening `Create voucher` and submitting empty inputs triggers field-level validation (`Title is required`, `Points cost must be positive`).
   - Registering draft voucher `Solar Cold Brew Promo` (150 pts, expires 2026-12-31) adds it to the catalog in draft status.
   - Filtering publication status by `Draft` isolates the newly created voucher.
   - Clicking `Set active` publishes the voucher to the active catalog with full reconstructed `RewardInput` payloads.
   - Deleting the voucher removes it cleanly from the catalog after confirmation dialog acceptance.

6. **Journey 6: Settings Configuration & Dynamic Awarding (`/settings`)**
   - Modifying the Cardboard & Paper points rate to `10 pts/item` marks the form dirty.
   - Attempting to navigate away prompts the `Unsaved Changes` dialog powered by React Router `useBlocker`; clicking `Cancel` preserves the dirty draft.
   - Saving settings applies the new calculation rules globally and displays the success notification banner.
   - Navigating to `/verification` and approving 4 pcs paper deposit `DEP-1087` awards `4 pcs × 10 pts = 40 pts` (updating Faris's wallet from 245 to 285 pts), proving cross-module reactive rule enforcement.

7. **Journey 7: Responsive Layout, Drawer & Accessibility (390×844)**
   - Switching to mobile viewport (390×844) renders the mobile header and hamburger menu toggle.
   - Clicking the hamburger button slides open the full navigation drawer.
   - Clicking the close button or backdrop dismisses the drawer and returns focus.
   - Navigating to `/bins` and opening modal dialogs verifies keyboard accessibility: pressing `Escape` dismisses the modal and restores background scroll.

---

## 4. Route & Component Architecture Audit

| Route | Component | State Source | Key Features Verified |
|---|---|---|---|
| `/overview` | `OverviewPage.tsx` | `dashboard.watchSummary` | Metric cards, 7-day activity bar chart, material mix breakdown, bins needing attention, quick simulation button. |
| `/bins` | `SmartBinsPage.tsx` | `bins.watchList` | Server-driven sorting, pagination, multi-field filters, create/edit modal, delete modal with conflict protection. |
| `/alerts` | `CapacityAlertsPage.tsx` | `alerts.watchList`, `alerts.watch` | Active/Resolved tabs, split list/detail layout, 5-step lifecycle tracker, dispatch collection, bin reset, alert resolve. |
| `/verification` | `DepositVerificationPage.tsx` | `verification.watchList`, `verification.watch` | Review queue, simulated camera preview, AI confidence indicator, masked resident IDs, idempotent approve/reject decisions. |
| `/vouchers` | `RewardsVouchersPage.tsx` | `rewards.watchList`, `rewards.watchCategories` | Category/publication filters, table sorting, voucher creation/editing modals, active/draft toggling, delete confirmation. |
| `/settings` | `SettingsPage.tsx` | `settings.watch` | Alert threshold selection, accepted material stream toggles, rate inputs, persistent dirty draft, `useBlocker` guard. |
| `/login` | `LoginPage.tsx` | `auth.login`, `auth.getDemoCredentials` | Autofill demo credentials, error feedback, redirect query preservation, logout intent handling. |

---

## 5. Design & Responsive Aesthetics

The implementation strictly satisfies the required rich aesthetic guidelines without external styling dependencies:
- **Typography:** Self-hosted Google Fonts Inter font family bundled locally in WOFF and WOFF2 formats; zero runtime Google Fonts CDN network calls.
- **Color System:** Harmonious HSL-derived palette featuring Forest Deep Green (`#176B45`), Mint Accents (`#E8F5E9`), Amber Warnings (`#F59E0B`), Coral Danger (`#EF4444`), and Slate Neutrals (`#1E293B`, `#64748B`, `#F8FAFC`).
- **Surface Elevation:** Layered cards with subtle borders (`1px solid #E2E8F0`), ambient box shadows (`0 1px 3px rgba(0,0,0,0.05)`), and glassmorphism backdrops (`backdrop-filter: blur(8px)`).
- **Responsive Layouts:**
  - **Desktop (1440px+):** Fixed 260px sidebar navigation rail, sticky header, multi-column grids, and side-by-side queue/detail inspection panels.
  - **Tablet (700px–900px):** Collapsed icon-only rail (72px) with tooltip labels and compact data tables.
  - **Mobile (390px–699px):** Off-canvas slide-over drawer with backdrop overlay, single-column stacked forms, horizontal scrolling table containers, and full-width modal sheets.

---

## 6. Goals 3 & 4: Firebase Production Handoff Specifications

In accordance with the EcoLoop master architecture, Goals 1 & 2 establish the standalone presentation layers (Flutter Mobile App and Web Admin Portal) using stateful in-memory mock repositories. Goals 3 & 4 will replace these mocks with live cloud services.

### Shared Project Alignment
Both client applications will connect to **one unified Firebase project**:
- **Project Name:** `ecoloop-smart-recycling`
- **Region:** `asia-southeast1` (Singapore / Malaysia latency optimization)

### Firestore Database Schema & Subcollections

```
firestore/
├── residents/                       # Resident profiles (UID-keyed)
│   └── {residentId}/
│       ├── profile                  # ResidentProfileDocument
│       └── security/accountSecurity # AccountSecurityDocument (protected)
├── wallets/                         # Wallet balances and transaction history
│   └── {residentId}/                # WalletDocument { balance, updatedAt, version }
├── smartBins/                       # Physical bin fleet telemetry and configuration
│   └── {binId}/                     # SmartBinDocument { capacityPercent, isOnline, ... }
├── binOperations/                   # Operational collection assignments
│   └── {binId}/                     # BinOperationsDocument { collectionStatus }
├── capacityAlerts/                  # Automated overflow threshold alerts
│   └── {alertId}/                   # CapacityAlertDocument { binId, status, thresholdPercent }
├── depositTransactions/             # Physical and AI-verified deposit logs
│   └── {transactionId}/             # DepositTransactionDocument { residentId, pointsAwarded, status }
├── verificationTickets/             # AI review queue for flagged deposits
│   └── {ticketId}/                  # VerificationTicketDocument { transactionId, status, flag }
├── rewardCategories/                # Categorization for resident rewards
│   └── {categoryId}/                # RewardCategoryDocument { label, sortOrder }
├── rewards/                         # Rewards and voucher catalog
│   └── {rewardId}/                  # RewardDocument { title, pointsCost, isActive, expiresAt }
├── residentVouchers/                # Resident-redeemed voucher instances
│   └── {voucherId}/                 # ResidentVoucherDocument { rewardId, residentId, code, status }
└── programSettings/                 # Global township recycling parameters
    └── global/                      # ProgramSettingsDocument { capacityAlertThreshold, acceptedMaterials }
        └── materialRates/           # Flat rate documents
            └── {materialType}/      # MaterialRateDocument { pointsPerItem, eligible }
```

### Authentication & Authorization Mapping
- **Resident Auth (Flutter Mobile):** Firebase Authentication via Email/Password and Phone Auth; resident profile keyed by `auth.currentUser.uid`.
- **Admin Auth (Web Portal):** Firebase Authentication with Custom Claims (`{ admin: true }`). Cloud Functions enforce claim checks before permitting reads/writes to administrative collections (`binOperations`, `capacityAlerts`, `verificationTickets`, `programSettings`).
- **Security Rules:**
  - Residents can read only their own `wallets/{uid}` and `residentVouchers/{uid}`; writes are restricted to trusted Cloud Functions.
  - Admins with `request.auth.token.admin == true` have read/write access to administrative operational collections.

### Cloud Storage Handoff
- **Deposit AI Images:** Stored at `gs://ecoloop-smart-recycling.appspot.com/deposits/{transactionId}/capture.jpg`. Web and mobile clients consume authenticated HTTPS download URLs or signed Cloud CDN URLs.
- **Reward Artwork:** Stored at `gs://ecoloop-smart-recycling.appspot.com/rewards/{rewardId}/art.webp`.
- **Rule:** No raw `gs://` URIs are exposed to client view layers; all image properties remain HTTPS URL strings.

### Firebase App Check & Web Hosting
- **Web Admin Hosting:** Built via `npm run build` and deployed to Firebase Hosting with single-page app rewrite rule:
  ```json
  {
    "hosting": {
      "public": "dist",
      "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
      "rewrites": [
        { "source": "**", "destination": "/index.html" }
      ]
    }
  }
  ```
- **App Check:** Protected with reCAPTCHA Enterprise on Web Admin and Google Play Integrity API on Android Flutter.

---

## 7. Preservation of Mobile & Repository Assets

- **Android Firebase Configuration:** `apps/resident_mobile/android/app/google-services.json` and all native Gradle files were preserved unmodified throughout all admin web phases.
- **Flutter Source Tree:** The Flutter resident application (`apps/resident_mobile/`) was completely untouched during this phase.
- **Repository Integrity:** All commits adhere to conventional commit standards with zero extraneous packages, untracked temporary files, or architectural violations.
