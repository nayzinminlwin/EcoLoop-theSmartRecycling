# BK-P02-C2 Bootstrap and Clock Evidence

**Captured:** 2026-10-18  
**Unit:** BK-P02-C2 — Explicit bootstrap and advancing real clock  
**Specification:** ECOLOOP-SPEC-001 sections 2, 9, 15 and 16  
**Status:** VERIFIED

## Runtime composition

- The default `ECOLOOP_FIREBASE_MODE=mock` path retains the existing seeded `MockDataStore`, fixed fixture clock and mock repositories.
- `emulator` and `firebase` modes are explicit. Bootstrap initializes typed Firebase clients, then fails visibly because the real feature adapters are intentionally not yet implemented. It never starts the mock resident/wallet graph under a real mode.
- Release builds reject non-`firebase` mode through `RuntimeConfig.validate()`.
- App Check debug activation is limited to an explicitly enabled debug emulator mode and uses the current `AndroidDebugProvider` API. Production mode does not silently receive a debug provider.
- The system clock factory uses `DateTime.now` on every `now` access. The existing constructor and metadata factory remain fixed-clock constructors for mock fixtures and deterministic tests.

## Verification

```text
flutter analyze
flutter test
```

Results:

- Flutter analyzer: **PASS — No issues found**.
- Full Flutter test suite: **PASS — 81 tests passed**.
- Focused runtime/clock tests cover explicit mock/emulator modes, invalid configuration, fixed fixture time, advancing system time, and display timezone preservation.

DTD was connected, but no Flutter app was available. A hot-restart attempt returned “No active app connection”; no runtime reload pass is claimed.
