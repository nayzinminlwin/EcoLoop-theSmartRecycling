# BK-P02-C3 Command Client Evidence

**Captured:** 2026-10-18  
**Unit:** BK-P02-C3 — Durable command client and pending intents  
**Specification:** ECOLOOP-SPEC-001 sections 2, 9, 15 and 16  
**Status:** VERIFIED

## Durable intent behavior

- Callable commands are wrapped in the canonical `backend.v1` envelope and validated through the shared Dart envelope parser.
- Durable operations persist only UID-scoped request identity and payload metadata before the callable: session/reservation transitions, inspection submission, reward redemption and voucher usage.
- The pending store uses `SharedPreferencesAsync` for non-secret metadata and maintains a separate installation identifier. It never stores wallet values, credentials or provider tokens.
- Ambiguous transport failures retain the pending intent. Recovery uses the canonical `recoverOperation` payload and the original request identity; it does not generate a replacement request ID.
- Changed payloads for an existing UID intent produce a deterministic conflict without another transport call.
- Terminal server rejections clear the pending intent. Pending records are isolated by authenticated UID.

## Verification

```text
flutter analyze
flutter test test\core\data\pending_operation_store_test.dart test\core\firebase\command_client_test.dart
flutter test
```

Results:

- Flutter analyzer: **PASS — No issues found**.
- Focused C3 tests: **PASS — 9 tests passed**.
- Full Flutter test suite: **PASS — 91 tests passed**.

DTD was connected, but no Flutter app was available. The required hot-restart readiness check reported “No active app connection”; no runtime reload pass is claimed.

Live callable recovery is intentionally not claimed here; its server handler is verified in the later P04/P05 units.
