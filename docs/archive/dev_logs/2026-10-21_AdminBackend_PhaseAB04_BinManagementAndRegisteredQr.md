# Dev Log: Admin Backend - Phase AB-04 Bin Management and Registered QR Codes

**Date and Time :** 2026-10-21 10:48  
**Agent:** Gemini 3.8 Flash High (Antigravity)  
**Moderator:** Alex  
**Status:** Completed  

## 1. Objective

Implement Phase AB-04 of the Admin Backend Activation Plan (`docs/archive/admin/ECOLOOP_ADMIN_BACKEND_IMPLEMENTATION_PLAN.md`), delivering trusted smart bin fleet management, immutable positive integer registration capacity, strict deletion safety fencing (never-used empty bins with permanent tombstoning), registered hardware QR code export (data URL and SVG), live portal UI adaptation (`SmartBinsPage.tsx`), and capacity simulation safety guards.

## 2. Reference Documents

- `docs/archive/admin/ECOLOOP_ADMIN_BACKEND_IMPLEMENTATION_PLAN.md` (Section 9, Phase AB-04)
- `docs/archive/backend/ECOLOOP_BACKEND_AND_CV_SPECIFICATION.md` (Sections 14, 16)
- `../../../contracts/admin/v1/commands.schema.json` and `dtos.schema.json`
- `../../../.agent/developer/agent.md`, `../../../.agent/web_developer/agent.md`

## 3. Changes Made

- **Files Created:**
  - `../../../functions/src/domain/admin_bins.ts`: Domain validations (`validateBinId`, `validateCapacitySpc`, `validateLocationName`, `validateLocationDetail`, `computeQrId`, `computeQrPayload`, `computeInitialCycleId`).
  - `../../../functions/src/infrastructure/firestore/admin_bins_store.ts`: Transactional store for bin fleet lifecycle (`createBin`, `updateBin`, `deleteUnusedBin`, `getBinQr`).
  - `../../../functions/src/transport/admin_bins.ts`: HTTPS callables in `us-central1` protected by `requireAdminCaller` (`adminCreateBin`, `adminUpdateBin`, `adminDeleteUnusedBin`, `getAdminBinQr`).
  - `../../../functions/tests/unit/admin_bins.test.ts`: Unit tests for domain validations, coherent registration, versioned updates, unused delete restrictions, and QR export.
  - `../../../apps/admin-web/tests/admin_bins_ab04.test.ts`: Unit tests for live Firebase repository mutations, error mapping, and mock mode QR code resolution.
  - `docs/archive/admin_backend/evidence/AB-04_bin_fleet_management.md`: Evidence document capturing verification, architecture decisions, and exit gates.
- **Files Modified:**
  - `../../../functions/src/composition.ts`: Wired `FirestoreAdminBinsStore` into the composition container.
  - `../../../functions/src/index.ts`: Exported the 4 admin bin callables.
  - `../../../functions/package.json`: Added `test:admin:bins`, `test:admin:auth`, and `test:admin:queries` scripts.
  - `../../../firestore.rules`: Permitted admin read access on `binCycles/{cycleId}`; blocked all client access on `binTombstones/{binId}`.
  - `../../../apps/admin-web/src/contracts/admin.ts`: Extended `BinInput` with optional `capacitySpc?: number` and `expectedVersion?: number`.
  - `../../../apps/admin-web/src/data/repositories.ts`: Added `BinQrCode` interface, `getQrCode` method to `BinsRepository`, and `"bins.getQrCode"` to `OperationName`.
  - `../../../apps/admin-web/src/data/mockRepositories.ts`: Implemented `getQrCode` on in-memory mock bins repository.
  - `../../../apps/admin-web/src/data/firebase/firebaseBinRepository.ts`: Implemented `create`, `update`, `delete`, `simulateCapacity` (disabled in live mode), and `getQrCode` using `commandClient.execute` and `httpsCallable`.
  - `../../../apps/admin-web/src/features/fleet/SmartBinsPage.tsx`: Adapted modal form with integer capacity, read-only occupancy on edit, active shared classes badges, and added a QR preview/download modal with "QR" table action.
  - `../../../apps/admin-web/src/features/operations/CapacityAlertsPage.tsx`: Guarded simulation trigger so it is only rendered when `services.mode !== "firebase"`.
  - `../../../apps/admin-web/package.json`: Added `tests/admin_bins_ab04.test.ts` to `check:tests` and `../../../test` scripts.
  - `docs/archive/admin_backend/EXECUTION_TRACKER.md`: Updated Phase AB-04 status to COMPLETE.
- **Impact to other modules:** No impact on Flutter mobile app or resident core repositories.

## 4. Technical Decisions & Deviations

- **Immutable Registration Capacity:** Rather than allowing arbitrary percentage-fill resets or changing physical receptacle volumes on standard edits, `capacitySpc` is fixed upon initial registration (50 to 5000 spc). Fill percentage is strictly a derived metric (`(occupiedSpc / capacitySpc) * 100`).
- **Coherent Initial Receptacle Creation:** Single multi-document transaction writes the canonical bin, the initial zero-opening cycle (`${binId}-cycle-001`), the private operations state (`phase: "available"`, `sessionId: null`), the hardware QR mapping (`binQrMappings/qr-{binId}`), the projected read view (`adminBinViews/{binId}`), and the audit event.
- **Delete Safety Fencing & Tombstoning:** Deletion is blocked if `occupiedSpc > 0`, if `phase !== "available"`, if `sessionId !== null`, or if any historical records exist in `batches`, `depositSessions`, `capacityAlerts`, or `collectionEvents`. Deleting an empty never-used bin writes a permanent record in `binTombstones/{binId}` with `retiredQrPayload`, guaranteeing retired IDs or payloads can never be recycled.
- **Registered QR Code Resolution:** The resident mobile app expects payloads formatted as `ecoloop://bin/{qrId}` where `qrId` maps to `binQrMappings/{qrId}`. We export QR codes carrying the exact registered hardware payload (`ecoloop://bin/qr-{binId}`), with both high-res PNG data URLs and clean SVG vectors for operator printing/labeling.

## 5. Verification Results

- `../../../functions`: `npm.cmd test` -> 13 test files passed, 58 tests passed (including 11 unit tests in `admin_bins.test.ts`).
- `../../../functions`: `npm.cmd run test:admin:bins` -> 11 passed.
- `../../../apps/admin-web`: `npm.cmd run check:tests` -> Exit code 0 (TypeScript strict check passed).
- `../../../apps/admin-web`: `npm.cmd run lint` -> Exit code 0 (Clean check over `src/main.tsx`).
- `../../../apps/admin-web`: `npm.cmd test` -> Exit code 0 (159 passed across 4 test suites).
- `../../../apps/admin-web`: `npm.cmd run build` -> Exit code 0 (Vite build completed in 590ms).
