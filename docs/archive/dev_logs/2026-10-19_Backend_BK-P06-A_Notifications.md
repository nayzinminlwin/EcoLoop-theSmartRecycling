# BK-P06-A Durable notification dispatcher

## Scope

Implemented the durable notification dispatcher specified by BK-P06-A and specification sections 9, 14, and 16:

- Claims committed `notificationEvents` intents by state and retry time.
- Re-reads current preferences and device associations at dispatch.
- Combines result and positive-credit components into one safe notification.
- Sends only safe event/batch target identifiers and decision version.
- Records provider acceptance/failure independently from settlement and wallet state.
- Uses bounded exponential retry and disables invalid registration tokens.
- Exposes a scheduled Firebase transport entrypoint.

## Changed paths

- `../../../functions/src/application/notifications.ts`
- `../../../functions/src/infrastructure/firestore/notifications_store.ts`
- `../../../functions/src/infrastructure/messaging.ts`
- `../../../functions/src/transport/notification_dispatch.ts`
- `../../../functions/src/composition.ts`
- `../../../functions/src/index.ts`
- `../../../functions/tests/unit/notifications.test.ts`

## Verification

- `Set-Location functions; npm run build` — passed.
- `Set-Location functions; npx vitest run tests/unit/notifications.test.ts` — passed, 3 tests.
- `git diff --check` — passed.

The focused tests cover combined result/credit messaging, current preference suppression, duplicate-safe single completion, multiple legitimate devices, and invalid-token disabling. Emulator and real Android/web provider delivery evidence remains for the later notification acceptance gate.
