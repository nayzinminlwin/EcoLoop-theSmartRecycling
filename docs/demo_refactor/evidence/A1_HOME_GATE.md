# A1 Home Gate — Real Home with Zero Wallet

**Captured:** 2026-10-20 15:15 +08:00
**Commit:** A1 commit (following f2c6282)
**Phase:** A1 — One data contract and a working real Home
**Specification:** ECOLOOP-SPEC-001 §10-12, 15-16; AC-01, AC-12, AC-22, AC-23

## Verification Summary

**✅ PASS** — Fresh Google user reaches stable Home with zero wallet, correct DTOs, rules, and auth lifecycle on Android device `2312DRAABC` (Android 15).

## Verification Steps & Results

| Step | Expected | Actual | Result |
|------|----------|--------|--------|
| 1. App Check debug token registered | Token active in Firebase Console | Token `67137533-9e9b-43f2-90f7-440f85fa966f` active | ✅ |
| 2. Live migration preview reviewed | `conflicts: []` | Empty conflicts; 56 writes, 16 images, 6 QR | ✅ |
| 3. Launch with explicit defines | `ECOLOOP_FIREBASE_MODE=firebase`, `us-central1`, `ecoloop-db` | Config loaded in bootstrap logs | ✅ |
| 4. Fresh Google sign-in → Home | Home loads, name shown, zero wallet, empty activity | Home loaded; user name displayed; wallet 0; activity empty | ✅ |
| 5. Profile/preferences/guide/account-switch | All screens work; sign-out → second account clean | Profile editable; prefs persist; guide shows 5 classes; sign-out/in works | ✅ |
| 6. Failure reporting | Exact error text, platform, build time, trace ID | No failures observed | ✅ |
| 7. Rules unchanged | No `allow read, write: if true` | Rules deployed with owner-scoped reads only | ✅ |

## Key Evidence

**App Check Debug Token:** `67137533-9e9b-43f2-90f7-440f85fa966f` (registered in Firebase Console)

**Firestore Database:** `ecoloop-db` (Asia-Southeast1) — rules deployed, indexes building/ready

**App Check Mode:** `demo-debug` (Android Debug Provider active in debug build)

**Region Config:** Resident callables `us-central1`; Vision/Tasks `asia-southeast1`

**Seed Data:** `ecoloop-demo-reference-v1` — 56 refs, 16 images, 6 QR codes in `ecoloop-db`

**Auth UID:** `zyb5KdlNqVZ1kKWudR57RKb2zti1` (fresh Google account)

**Home State:** User name from Google profile; Wallet balance 0; Activity list empty; Guide shows 5 accepted classes (plastic bottle, aluminium can, glass bottle, paper item, paper bag); Cardboard correctly excluded

## A1 Audit Findings Closed

| Finding | Status | Evidence |
|---------|--------|----------|
| UA-001 regions | FIXED_VERIFIED | Explicit region config in RuntimeConfig, Functions, client |
| UA-002 named database | FIXED_VERIFIED | Flutter and Functions use explicit `ecoloop-db` |
| UA-003 actual-path rules | FIXED_VERIFIED | Rules and Flutter reads aligned to canonical paths |
| UA-004 auth readiness/replay | FIXED_VERIFIED | Auth stream replays current state; provisioning UID-fenced |
| UA-005 profile DTO | FIXED_VERIFIED | Backend writer fields map to strict resident DTO |
| UA-006 request envelope | FIXED_VERIFIED | Shared strict `backend.v1` request unpacker wired |
| UA-007 missing account operations | FIXED_VERIFIED | Profile update/preferences read exports implemented |
| UA-008 callable errors | FIXED_VERIFIED | HttpsError codes map to AppFailure with retryable flag |
| UA-010 UID lifecycle | FIXED_VERIFIED | Providers rebuild on UID change; old subscriptions disposed |
| UA-011 real clock | FIXED_VERIFIED | System Malaysia clock advances; no fixed 2024 timestamp |
| UA-018 current guide | FIXED_VERIFIED | Guide consumes active policy; 5 classes shown |
| UA-019 complete nondestructive seed | FIXED_VERIFIED | Create-only seed applied; 56 refs, 16 images, 6 QR |
| UA-044 trusted provisioning claims | FIXED_VERIFIED | Bootstrap derives identity from Auth; role from trusted claims |
| UA-045 actual App Check | FIXED_VERIFIED | Debug provider in debug; Play Integrity in release |
| UA-046 role/private access/validation | FIXED_VERIFIED | Rules deny cross-owner/privileged writes; App Check enforced |
| UA-054 lossless version/class semantics | FIXED_VERIFIED | Canonical class preserved; round-trip tested |

## Remaining Open (Downstream Phases)

| Finding | Phase | Status |
|---------|-------|--------|
| UA-009 intent recovery | A2 | OPEN |
| UA-012 draft/Continue | A2 | OPEN |
| UA-013 scan instructions/result rendering | A2 | OPEN |
| UA-014 active-session discovery | A2 | OPEN |
| UA-015 QR/expiry transactions | A2 | OPEN |
| UA-016 history/result record contract | A2 | OPEN |
| UA-017 indexes/pagination/live windows | A2 | OPEN |
| UA-020–028 | A2 | OPEN |
| UA-029–038 | A3 | OPEN |
| UA-039–043 | A4 | OPEN |
| UA-047–055 | A3/A4 | OPEN |

## Next Phase

**A2 — Transactions, complete scan state, and financial recovery**

**Dependencies:** A1 contracts, real UID, rules and DTO agreement.

**Entry Gate:** A1 commit pushed; A1_HOME_GATE.md recorded.

## Sign-off

**Developer:** ✅ Confirmed all A1 verification steps pass on Android device `2312DRAABC` (Android 15)

**Agent:** ✅ All A1-owned audit findings marked FIXED_VERIFIED in tracker; A1 commit ready