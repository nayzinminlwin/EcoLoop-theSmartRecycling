# Phase 2 Audit and Follow-up Fixes

**Scope:** BK-P02-A through BK-P02-F  
**Specification:** ECOLOOP-SPEC-001 v1.1  
**Audit date:** 2026-10-18

## Audit conclusion

Phase 2 had broad automated coverage, but it was not fully production-complete. The audit found one release-blocking authorization mismatch and one lifecycle defect in the UID-scoped profile composition. It also confirmed integration gaps that remain outside this follow-up.

## Findings

| Finding | Severity | Result |
| --- | --- | --- |
| Ordinary account bootstrap could return role `resident`, while Flutter accepts only `user` and `admin` | High | Fixed |
| Profile provider resolved the first UID only and did not restart on account changes | High | Fixed |
| Flutter profile/preferences callable DTOs are not yet aligned with the canonical command contract | High | Remains open for the account-read contract unit |
| Real Android/web Google sign-in smoke is blocked by OAuth domains, Android SHA configuration, and unavailable active runtime | Medium | Remains documented blocker |
| Seed tests do not yet assert uploaded Storage objects independently of Firestore metadata | Low | Remains a test-coverage gap |

## Fixes applied

### Authorization role normalization

The backend default authorization role is now `user`. Admin custom claims remain `admin`; unknown or absent ordinary claims no longer produce the unsupported `resident` role. Emulator fixtures and assertions were updated accordingly.

This change is intentionally limited to authorization roles. Resident entity terminology remains where it is part of the data model and specification, including `residents/{uid}`, `residentId`, `ResidentProfile`, and resident account callable names. These names identify records or domain entities, not a third authorization role.

### UID-driven profile provider

The shared account profile provider now listens to the authentication stream for its entire lifetime. On each UID transition it cancels the previous profile subscription, emits `null` while signed out, and starts a new profile subscription for the active account. Provider cancellation also disposes both subscriptions.

Settings and home now consume this shared provider rather than creating separate one-shot UID/profile resolution paths. A focused test verifies the initial profile and signed-out transition.

## Validation

The focused Flutter account/provider tests pass, including the UID-scoped profile transition test. `flutter analyze` passes with no issues after the provider aliases were normalized. Full Flutter, Functions, and emulator gates from the preceding BK-P02-F completion remain recorded in [SEEDING.md](SEEDING.md) and [ROUTING_UID_COMPOSITION.md](ROUTING_UID_COMPOSITION.md).

No live Android/web authentication evidence is claimed. The remaining callable DTO and Storage-object verification gaps must be closed before declaring every Phase 2 integration surface complete.
