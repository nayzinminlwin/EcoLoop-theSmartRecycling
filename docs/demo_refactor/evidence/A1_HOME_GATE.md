# A1 Home Gate

- **Captured:** 2026-10-20
- **Implementation source:** A1 commit `f2c6282`
- **Firebase mode contract:** `ECOLOOP_FIREBASE_MODE=firebase`
- **Project/database:** `ecoloop-thesmartrecycling` / `ecoloop-db`
- **Callable region:** `us-central1`
- **Clock:** system clock with `en_MY` display and UTC+08:00 calendar conversion

## Automated boundary evidence

| Check | Result |
| --- | --- |
| Functions TypeScript and contract build | PASS |
| Flutter targeted `flutter analyze` | PASS |
| Functions account emulator suite | PASS (5 tests) |
| Firestore/Storage rules suite | PASS (5 tests) |
| Canonical resident wallet/stats reads | Implemented and analyzed |
| Profile writer-to-DTO mapping | Implemented (`residentId/displayName` -> `id/fullName`) |
| Auth late subscriber/retry fence | Implemented; focused account tests pass |
| Home mock regression | Existing stale text assertion failed; unrelated to Firebase boundary changes and remains open |

## Live/platform gate

The Android and HTTPS-web fresh-account observations, account switch, and
developer-owned App Check/debug-token confirmation were **not run in this
agent session**. The implementation must not be described as a live Home pass
until the developer launches the committed candidate with a fresh account and
records the visible name, zero wallet, empty activity, guide, preferences,
sign-out, and second-account switch. A failure must include its safe request or
trace ID and remain a blocker in the tracker.

No live migration or wallet reset was performed. The existing create-only seed
and its independent live evidence remain the only cloud data change.
