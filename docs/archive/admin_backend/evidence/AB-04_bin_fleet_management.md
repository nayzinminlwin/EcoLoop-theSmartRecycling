# Phase AB-04 Evidence: Trusted Bin Management and Registered QR Codes

- **Phase:** AB-04
- **Plan Reference:** [ECOLOOP_ADMIN_BACKEND_IMPLEMENTATION_PLAN.md](../../admin/ECOLOOP_ADMIN_BACKEND_IMPLEMENTATION_PLAN.md)
- **Author/Role:** Antigravity (Gemini 3.8 Flash High) / Backend & Integration Specialist
- **Date:** 2026-10-21
- **Status:** COMPLETE
- **Target Commit Message:** `feat: activate admin bin management and QR registration`

---

## 1. Executive Summary

Phase AB-04 implements end-to-end trusted smart bin fleet management, immutable registration capacity, safety fencing for unused receptacle deletion, and registered hardware QR code export.

Key outcomes achieved:
1. **Coherent Bin Registration:** Atomic multi-document transaction creating:
   - Canonical bin record `bins/{binId}` with immutable integer capacity (50..5000 spc) and initial 0 occupiedSpc.
   - Initial zero-opening cycle `binCycles/{cycleId}` (`${binId}-cycle-001`).
   - Private operations state `binOperations/{binId}` (`phase: "available"`, `sessionId: null`).
   - Enabled hardware QR mapping `binQrMappings/{qrId}` (`qrId: "qr-" + binId`, `qrPayload: "ecoloop://bin/" + qrId`).
   - Materialized read view `adminBinViews/{binId}`.
   - Immutable audit receipt in `adminAuditEvents`.
2. **Idempotency & Version Concurrency:**
   - Privileged callables (`adminCreateBin`, `adminUpdateBin`, `adminDeleteUnusedBin`) checked against `adminOperations/{scopedHash}`.
   - Version-checked updates rejecting stale expected versions with `failed-precondition`.
3. **Strict Deletion Safety Fencing & Tombstoning:**
   - Unused deletion permitted ONLY for bins with `occupiedSpc === 0`, `phase === "available"`, and `sessionId === null`.
   - Verified zero historical references across `batches`, `depositSessions`, `capacityAlerts`, and `collectionEvents`.
   - Deletion removes operational and view records, and writes a permanent record to `binTombstones/{binId}`, preventing reuse of retired bin IDs or QR payloads.
4. **QR Code Export & Data URL Generation:**
   - Backend callable `getAdminBinQr` generates high-resolution PNG data URLs and SVG vectors directly from the registered hardware payload (`ecoloop://bin/qr-{binId}`).
5. **Admin Portal UI Adaptation (`SmartBinsPage.tsx`):**
   - Modal form updated: replaces editable fill percentage with positive integer `capacitySpc` (50–5000 spc).
   - On editing, capacity and ID are strictly immutable; fill percentage is displayed as derived from physical occupancy.
   - Replaced per-bin material checkboxes with informational badges of active shared classes (`plastic_bottle`, `aluminium_can`, `glass_bottle`, `paper_item`, `paper_bag`) governed globally by program policy.
   - Added `QR` action button to each row in the fleet table opening a preview modal with PNG and SVG download options.
6. **Simulation Safety Guard:**
   - Guarded `Simulate BIN-004 to 85%` button on `CapacityAlertsPage.tsx` so it is hidden when running in live Firebase mode (`services.mode === "firebase"`).
   - `FirebaseBinRepository.simulateCapacity` throws `RepositoryError` (`code: "invalidTransition"`) in live mode.

---

## 2. Changes Made by Layer

### 2.1 Backend Domain (`../../../../functions/src/domain`)
- **`admin_bins.ts`:**
  - `validateBinId`: regex `/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/`.
  - `validateCapacitySpc`: ensures safe integer between 50 and 5000 spc.
  - `validateLocationName`: bounds string between 2 and 100 characters.
  - `validateLocationDetail`: bounds string between 2 and 160 characters.
  - Helper functions: `computeQrId`, `computeQrPayload`, `computeInitialCycleId`.

### 2.2 Backend Infrastructure (`../../../../functions/src/infrastructure/firestore`)
- **`admin_bins_store.ts` (`FirestoreAdminBinsStore`):**
  - `createBin`: Validates inputs, checks idempotency via `operationsStore.getReceipt`, runs Firestore transaction verifying no existing document or tombstone, writes `bins`, `binCycles`, `binOperations`, `binQrMappings`, and `adminAuditEvents`, writes projected `adminBinViews`, records receipt via `operationsStore.recordReceipt`, and bumps `adminReadVersions/bins`.
  - `updateBin`: Validates inputs, checks idempotency, checks expected version matches current version, updates location details and enabled status on bin and QR mapping, updates projected view, records audit and receipt, and bumps revision.
  - `deleteUnusedBin`: Verifies `occupiedSpc === 0`, verifies `binOperations.phase === "available"` and `sessionId === null`, verifies zero matches in `batches`, `depositSessions`, `capacityAlerts`, and `collectionEvents`, deletes operational records in transaction, writes permanent `binTombstones/{binId}`, and records receipt.
  - `getBinQr`: Verifies bin exists and uses `qrcode` library to generate 512px PNG `dataUrl` and vector `svg` string.

### 2.3 Backend Transport & Security (`../../../../functions/src/transport`, `../../../../functions/src/index.ts`, `../../../../firestore.rules`)
- **`admin_bins.ts`:**
  - Exported HTTPS callables: `adminCreateBin`, `adminUpdateBin`, `adminDeleteUnusedBin`, and `getAdminBinQr` configured with `region: "us-central1"` and protected by `requireAdminCaller`.
- **`composition.ts`:**
  - Registered `FirestoreAdminBinsStore` in `getComposition().adminBins`.
- **`../../../../firestore.rules`:**
  - Added explicit rules for `binCycles/{cycleId}`: readable by enabled admin only (`allow read: if isAdmin(); allow write: if false;`).
  - Added explicit rules for `binTombstones/{binId}`: client access denied (`allow read, write: if false;`).

### 2.4 Web Contracts & Repositories (`../../../../apps/admin-web`)
- **Contracts (`src/contracts/admin.ts`):**
  - Extended `BinInput` with optional `capacitySpc?: number` and `expectedVersion?: number`.
- **Repositories Contract (`src/data/repositories.ts`):**
  - Added `BinQrCode` interface (`binId`, `qrId`, `qrPayload`, `dataUrl`, `svg`).
  - Added `getQrCode(id: string): Promise<BinQrCode>` to `BinsRepository`.
  - Added `"bins.getQrCode"` to `OperationName` union.
- **Firebase Adapter (`src/data/firebase/firebaseBinRepository.ts`):**
  - Implemented `create` passing `capacitySpc` via `commandClient.execute("adminCreateBin", ...)`.
  - Implemented `update` passing `expectedVersion` via `commandClient.execute("adminUpdateBin", ...)`.
  - Implemented `delete` via `commandClient.execute("adminDeleteUnusedBin", ...)`.
  - Implemented `simulateCapacity` to throw `RepositoryError` with `invalidTransition`.
  - Implemented `getQrCode` invoking `getAdminBinQr` callable.
- **Mock Repositories (`src/data/mockRepositories.ts`):**
  - Implemented `getQrCode` on mock bins repository to support mock mode and unit tests.

### 2.5 Web UI (`../../../../apps/admin-web/src/features`)
- **Fleet Management (`src/features/fleet/SmartBinsPage.tsx`):**
  - Form modal: Integer capacity input on registration; disabled with current fill badge on edit.
  - Location fields: Location name and detail validated on submit.
  - Informational badges: Displays active accepted classes from shared program policy.
  - Table: Added `QR` action button next to `Edit` and `Delete`.
  - QR Modal: Preview of registered QR code with payload `ecoloop://bin/qr-{id}`, and direct browser download for PNG and SVG formats.
- **Operations Alerts (`src/features/operations/CapacityAlertsPage.tsx`):**
  - Wrapped capacity simulation trigger in `services.mode !== "firebase"` condition.

---

## 3. Verification & Acceptance Results

### 3.1 Backend Functions Tests
- Command: `npm.cmd test`
- Output:
  ```
  Test Files  13 passed (13)
       Tests  58 passed (58)
  Duration  3.16s
  ```
- Command: `npm.cmd run test:admin:bins`
- Output:
  ```
  ✓ tests/unit/admin_bins.test.ts (11 tests) 46ms
  Test Files  1 passed (1)
       Tests  11 passed (11)
  ```

### 3.2 Admin Web Tests & Linting
- Command: `npm.cmd run check:tests`
- Output: Exit code 0 (TypeScript compilation of all 4 test suites succeeded).
- Command: `npm.cmd run lint`
- Output: Exit code 0 (Clean TypeScript check over `src/main.tsx`).
- Command: `npm.cmd test`
- Output: Exit code 0 (159 tests passed, 0 failures across all 4 suites).
- Command: `npm.cmd run build`
- Output: Exit code 0 (Vite client bundle built successfully in 590ms).

---

## 4. Next Phase

- **Next Phase:** Phase AB-05 — Immutable program settings and future-policy publication.
