# BK-P02-E Routing and UID-Scoped Composition Evidence

**Captured:** 2026-10-18  
**Unit:** BK-P02-E — Routing and UID-scoped composition  
**Specification:** ECOLOOP-SPEC-001 sections 2, 9, 15 and 16  
**Status:** VERIFIED — real platform smoke remains blocked by BK-P02-D prerequisites

## Composition and routing

- Real runtime bootstrap now initializes Firebase clients and overrides the account repository with `FirebaseAccountRepository`; mock bootstrap continues to use the seeded fixture graph.
- The signed-out route accepts an injected sign-in builder. Mock route tests retain the demo session screen, while real composition supplies the Google sign-in screen/controller.
- `RouteGuards` subscribes once and also resolves the current auth identity, so Firebase sessions that do not emit an initial stream event do not remain indefinitely on bootstrap.
- Pending deep links preserve path/query/fragment through provisioning and are consumed once after a resident-ready state.
- Account profile streams are keyed by the current UID and clear on sign-out/account changes.
- Wallet, activity, scan, rewards and recycling-guide providers explicitly reject non-mock runtime modes until their Firebase adapters are implemented. Real mode cannot silently display mock resident data.
- The account bootstrap remains the source of the zero-wallet baseline; this unit does not claim live wallet UI wiring before P04/P05.

## Verification

```text
flutter analyze
flutter test test\app\route_guards_test.dart test\app\app_router_test.dart test\features\account\account_providers_test.dart
flutter test
```

Results:

- Flutter analyzer: **PASS — No issues found**.
- Routing/provider-focused tests: **PASS**.
- Full Flutter test suite: **PASS — 94 tests passed**.
- Required DTD hot-restart attempt: **NOT AVAILABLE — no active Flutter app connection**.

Live Android/web routing smoke remains blocked by the BK-P02-D OAuth authorized-domain and Android SHA prerequisites. No live wallet or feature-adapter gate is claimed here.
