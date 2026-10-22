# Dev Log: Admin Backend - Phase AB-02 Admin Identity and Command Recovery

**Date and Time :** 2026-10-21 09:45  
**Agent:** Gemini 3.8 Flash High (Antigravity)  
**Moderator:** Alex  
**Status:** Completed  

## 1. Objective

Implement Phase AB-02 of the Admin Backend Activation Plan (`docs/ECOLOOP_ADMIN_BACKEND_IMPLEMENTATION_PLAN.md`), connecting the React 19 admin frontend (`apps/admin-web/`) to authoritative Firebase Authentication, custom token claims (`role: "admin"`), backend enabled account verification (`adminAccounts/{uid}`), trusted command client with stable intent recovery, and security rule hardening.

## 2. Reference Documents

- `docs/ECOLOOP_ADMIN_BACKEND_IMPLEMENTATION_PLAN.md` (Section 7, Phase AB-02)
- `docs/ECOLOOP_BACKEND_AND_CV_SPECIFICATION.md` (Sections 14, 16, 17)
- `contracts/admin/v1/commands.schema.json` and `dtos.schema.json`
- `.agent/developer/agent.md`, `.agent/web_developer/agent.md`

## 3. Changes Made

- **Files Created:**
  - `apps/admin-web/src/vite-env.d.ts`: Vite environment and image module declarations.
  - `apps/admin-web/src/core/firebase/config.ts`: Runtime mode and Firebase environment loader with named database `ecoloop-db`.
  - `apps/admin-web/src/core/firebase/app.ts`: Firebase App, Auth, Firestore, and Functions singleton initialization.
  - `apps/admin-web/src/core/firebase/appCheck.ts`: reCAPTCHA Enterprise and emulator App Check handler.
  - `apps/admin-web/src/core/firebase/commandClient.ts`: Administrative command transport and recovery client.
  - `apps/admin-web/src/data/firebase/firebaseAuthRepository.ts`: Authoritative Firebase Auth repository with custom claims and enabled account validation.
  - `apps/admin-web/tests/admin_auth_ab02.test.ts`: Unit tests for config, command client error mapping, and idempotency hashing.
  - `functions/src/domain/admin_crypto.ts`: Pure domain cryptographic helpers for scoped hashing and payload fingerprinting.
  - `functions/src/infrastructure/firestore/admin_accounts_store.ts`: Store reading and verifying `adminAccounts/{uid}`.
  - `functions/src/infrastructure/firestore/admin_operations_store.ts`: Store managing idempotent receipts under `adminOperations/{scopedHash}`.
  - `functions/src/transport/admin_guard.ts`: Reusable security guard for admin callables.
  - `functions/src/transport/admin_context.ts`: Callables for `getAdminContext` and `recoverAdminOperation`.
  - `functions/tools/admin_provision.ts`: CLI tool for admin account provisioning and status management.
  - `docs/admin_backend/evidence/AB-02_auth_and_recovery.md`: Comprehensive phase evidence document.
- **Files Modified:**
  - `apps/admin-web/package.json`: Pinned `firebase: "10.14.1"` and updated test scripts.
  - `apps/admin-web/src/app/services.ts`: Replaced mock bundle singleton with mode-aware `AdminServiceBundle`.
  - `apps/admin-web/src/app/LoginPage.tsx`: Hid demo credentials button in live `firebase` mode.
  - `apps/admin-web/src/ui/primitives.tsx`: Added reference to `vite-env.d.ts` for clean asset typing.
  - `functions/src/composition.ts`: Added `adminAccounts` and `adminOperations` to composition container.
  - `functions/src/index.ts`: Exported `getAdminContext` and `recoverAdminOperation` callables.
  - `functions/tools/copy-contracts.mjs`: Extended to package `contracts/admin/v1/`.
  - `firestore.rules`: Upgraded `isAdmin()` to require enabled record in `adminAccounts/{uid}`, denied direct client writes to attempt subcollections, and specified admin collection access rules.
  - `storage.rules`: Hardened `inspection-evidence` to prevent raw client claim bypass.
  - `docs/admin_backend/EXECUTION_TRACKER.md`: Updated Phase AB-02 status to COMPLETE.
- **Impact to other modules:** No impact on Flutter mobile app; shared security rules tightened to prevent unauthorized writes.

## 4. Technical Decisions & Deviations

- **Dual-Layer Authorization Guard:** Custom Auth claim `role: "admin"` provides fast client-side routing, while server-side `adminAccounts/{uid}.enabled === true` check stops compromised or revoked accounts instantly even before token expiration.
- **Standard Field Declarations:** Refactored TypeScript constructor parameter properties (`constructor(private readonly x: X)`) to explicit field declarations to ensure complete compatibility with Node.js `--experimental-strip-types` runner.
- **Clean Architecture Domain Crypto:** Isolated pure cryptographic algorithms (`computeScopedHash`, `computePayloadFingerprint`) into `functions/src/domain/admin_crypto.ts` with zero external SDK dependencies, allowing safe sharing between frontend tests and backend stores.

## 5. Phase AB-02 Deliverables

| Deliverable | Completion | Description |
|-------------|-------------|-------------|
| Firebase Browser SDK integration (`apps/admin-web/package.json`) | ✅ | `firebase@10.14.1` installed and configured |
| Real Auth Repository (`firebaseAuthRepository.ts`) | ✅ | Handles login, logout, token claims, and enabled account check |
| Service Composition (`AdminServiceBundle` in `services.ts`) | ✅ | Supports mock, emulator, and live firebase modes |
| Command Client & Recovery (`commandClient.ts`, `admin_context.ts`) | ✅ | Stable intent IDs, error mapping, and `recoverAdminOperation` |
| Security Rules (`firestore.rules`, `storage.rules`) | ✅ | Denies direct writes; routes evidence behind server guard |
| Admin Provisioning Tool (`tools/admin_provision.ts`) | ✅ | Controlled CLI tool for admin user provisioning |
| Unit Tests (`tests/admin_auth_ab02.test.ts`, `functions/tests/unit/admin_auth.test.ts`) | ✅ | All 14 tests passing in web (142 total) and 11 tests in functions (31 total) |
| Evidence & Dev Log | ✅ | `AB-02_auth_and_recovery.md` and this dev log created |

## 6. Next Steps / Known Issues

- **Next Steps:** Proceed to Phase AB-03: Real read layer, query projections (`adminBinViews`, `adminRewardViews`), composite indexes, and cursor pagination.
- **What Moderator needs to do manually:** To test live admin sign-in, run `npx tsx tools/admin_provision.ts --environment=live --email=<admin-email> --password=<admin-password>` in `functions/` to provision the administrator credentials.
- **What the Tester agent should focus on:** Validate that signing in with non-admin resident credentials or disabled admin accounts correctly triggers permission denial and prevents portal access.
