# Phase AB-02 Evidence: Real Admin Identity, Service Composition and Command Recovery

- **Phase:** AB-02
- **Plan Reference:** [ECOLOOP_ADMIN_BACKEND_IMPLEMENTATION_PLAN.md](../../ECOLOOP_ADMIN_BACKEND_IMPLEMENTATION_PLAN.md)
- **Author/Role:** Antigravity (Gemini 3.8 Flash High) / Backend & Integration Specialist
- **Date:** 2026-10-21
- **Status:** COMPLETE
- **Target Commit Message:** `feat: connect admin authentication and trusted command transport`

---

## 1. Executive Summary

Phase AB-02 connects the React 19 administrative portal (`apps/admin-web/`) to authoritative Firebase Authentication and trusted backend command transports in `functions/`. Ordinary residents and disabled administrators are strictly prevented from accessing administrative data or issuing commands.

Key outcomes achieved:
1. **Authoritative Identity:** Direct Firebase Auth email/password authentication validating both custom token claims (`role: "admin"`) and server-side document state (`adminAccounts/{uid}.enabled == true`).
2. **Service Composition:** Replaced `MockBundle` singleton with `AdminServiceBundle` that resolves `mock`, `emulator`, or `firebase` modes dynamically, with fail-fast validation in production builds.
3. **Trusted Command Transport & Recovery:** Introduced `FirebaseCommandClient` generating client-side stable intent IDs (`req-UUID`), alongside backend `getAdminContext` and `recoverAdminOperation` callables with SHA-256 scoped receipt storage (`adminOperations/{scopedHash}`).
4. **App Check & Security Hardening:** Initialized App Check with reCAPTCHA Enterprise provider; hardened `firestore.rules` (requiring `adminAccounts/{uid}.enabled == true`, denying direct client attempt writes) and `storage.rules` (routing inspection evidence reads behind server guard).
5. **Admin Account Provisioning:** Authored `functions/tools/admin_provision.ts` CLI for controlled account creation, claim assignment, and account enabling/disabling.

---

## 2. Changes Made by Layer

### 2.1 Web Application (`apps/admin-web/`)
- **Dependencies (`package.json`):** Pinned `firebase: "10.14.1"`.
- **Environment & Mode Resolution (`src/core/firebase/config.ts`):** Environment loader validating `VITE_ECOLOOP_BACKEND_MODE` (`mock` | `emulator` | `firebase`), explicit named database `ecoloop-db`, region `us-central1`, and production API key presence.
- **Firebase Initialization (`src/core/firebase/app.ts`):** Singleton initializing `FirebaseApp`, `Auth`, `Firestore` (named `ecoloop-db`), and `Functions` (`us-central1`), with emulator connection support.
- **App Check (`src/core/firebase/appCheck.ts`):** reCAPTCHA Enterprise provider initialization with explicit emulator debug handling.
- **Command Client (`src/core/firebase/commandClient.ts`):** Stable intent ID generation, callable invocation, Firebase error code mapping to typed `RepositoryError`, and receipt recovery.
- **Auth Repository (`src/data/firebase/firebaseAuthRepository.ts`):** Full implementation of `AuthRepository`:
  - `watchAuthState()`: Listens to `onIdTokenChanged`, evaluates `claims.role === "admin"`, distinguishes loading from unauthenticated/unauthorized.
  - `login()`: Direct email/password sign-in; validates custom claim and calls `getAdminContext`. Rejects non-admin or disabled admin immediately with `signOut()`.
  - `getDemoCredentials()`: Disabled in `firebase` mode.
- **Service Bundle (`src/app/services.ts`):** Composes `AdminServiceBundle` according to active mode. Triggers query invalidation and subscription cleanup on auth state changes.
- **UI Adaptation (`src/app/LoginPage.tsx`):** Hidden "Use demo credentials" button when in `firebase` mode.

### 2.2 Backend Functions (`functions/`)
- **Domain Cryptography (`src/domain/admin_crypto.ts`):** Pure utilities computing deterministic `scopedHash` (`SHA256(actorUid:operation:requestId)`) and `payloadFingerprint`.
- **Admin Accounts Store (`src/infrastructure/firestore/admin_accounts_store.ts`):** Transactional reader and verifier of `adminAccounts/{uid}` records.
- **Admin Operations Store (`src/infrastructure/firestore/admin_operations_store.ts`):** Storage and recovery for committed admin mutation receipts under `adminOperations/{scopedHash}`.
- **Composition (`src/composition.ts`):** Integrated `adminAccounts` and `adminOperations` into the composition container.
- **Admin Guard (`src/transport/admin_guard.ts`):** Reusable security guard enforcing authentication, admin custom claim, enabled status, and trace ID propagation.
- **Admin Callables (`src/transport/admin_context.ts` & `src/index.ts`):**
  - `getAdminContext`: Validates admin context, returns project/database/mode environment metadata and current server time.
  - `recoverAdminOperation`: Replays committed operation receipts for inflight or ambiguous requests by `targetRequestId`.
- **Provisioning Tool (`tools/admin_provision.ts`):** CLI tool supporting `--action=provision|disable|enable|check` on `ecoloop-db`.
- **Build Script (`tools/copy-contracts.mjs`):** Extended to package `contracts/admin/v1/` into `lib/contracts/admin/v1/`.

### 2.3 Security Rules
- **`firestore.rules`:**
  - Upgraded `isAdmin()` helper to require `request.auth.token.role == 'admin'` AND existence of enabled record:
    ```firestore
    exists(/databases/$(database)/documents/adminAccounts/$(request.auth.uid)) &&
    get(/databases/$(database)/documents/adminAccounts/$(request.auth.uid)).data.enabled == true
    ```
  - Removed write permission on `inferenceJobs/{jobId}/{subcollection}/{documentId}` (`allow write: if false`).
  - Added strict rules for `adminAccounts`, `adminSettings`, `adminOperations` (write false), `adminAuditEvents`, `adminBinViews`, `adminAlertViews`, `adminReviewViews`, `adminRewardViews`, and `adminDashboard`.
- **`storage.rules`:**
  - Removed client claim bypass on `inspection-evidence/{residentId}/...`, enforcing that admin evidence inspection is accessed through the authorized server callable returning signed URLs.

---

## 3. Verification & Test Evidence

### 3.1 Unit & Contract Tests
- Executed full test suite (`npm test` in `apps/admin-web/`):
  - **137 tests passing across 44 suites (0 failures).**
  - Includes 128 tests from `tests/contracts.test.ts` and 9 tests from `tests/admin_auth_ab02.test.ts`.
- Specific Phase AB-02 assertions verified:
  - Configuration correctly defaults to `ecoloop-db`, `ecoloop-thesmartrecycling`, and `us-central1`.
  - Request IDs match schema pattern `^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$`.
  - Firebase errors (`unauthenticated`, `permission-denied`, `not-found`, `failed-precondition`, `invalid-argument`) map cleanly to typed `FailureCode`s (`unauthenticated`, `permissionDenied`, `notFound`, `conflict`, `validation`).
  - Scoped hash and payload fingerprinting are deterministic.

### 3.2 Compilation & Production Build
- `npm run check:tests`: 0 TypeScript errors.
- `npm run lint`: 0 TypeScript errors.
- `npm run build`: Production Vite bundle generated in 1.98s (`dist/index.html`, `dist/assets/`).

---

## 4. Exit Gate Checklist

- [x] **Authentication & Role Guards:** Valid admin login/logout works; non-admin accounts and disabled admin accounts fail access and trigger immediate sign-out.
- [x] **Error States:** Wrong password (`validation`), unauthenticated (`unauthenticated`), missing claims (`permissionDenied`), and transport failures produce distinct recoverable states.
- [x] **Command Recovery:** `FirebaseCommandClient.recover()` and `recoverAdminOperation` callable re-deliver original committed command receipts using stable intent IDs.
- [x] **Rules Hardened:** Direct client writes to attempts, business records, and operation receipts are denied; admin evidence reads routed behind server guard.
- [ ] **Git Commit:** Target message `feat: connect admin authentication and trusted command transport`.
