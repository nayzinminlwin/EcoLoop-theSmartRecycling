# Acceptance Traceability and Execution Runbooks

**Authority:** [Specification §18](../ECOLOOP_BACKEND_AND_CV_SPECIFICATION.md#18-verification-and-acceptance-specification). All test paths below are planned targets; a row becomes proven only when its actual report/command/device evidence is recorded.

## R1. AC-to-implementation matrix

`FE` below means `functions/tests/emulator/`; `VU` means `services/vision/tests/`. Expand these prefixes in actual evidence logs.

| Spec ID | Primary units | Concrete test/evidence target | First diagnostic reference |
| --- | --- | --- | --- |
| AC-01 | P02-B/D/E | `FE/accounts.test.ts`, account flow test, actual Google auth smoke | `account.bootstrap_*`, resolved UID/zero wallet |
| AC-02 | P02-F, P04-A/J/K | `FE/sessions.test.ts`, actual camera/QR run | `scan.qr_decoded`, reservation ID |
| AC-03 | P04-I1/I2/J/K | picker/model/backend scan-flow tests | draft revision and committed asset version |
| AC-04 | P01-C, P03, P04-E/K | policy/finalization tests, real trace and mixed-image run | 37-point ledger and 61-spc posting |
| AC-05 | P03-B, P04-E/H | resolution/finalization cases and zero receipt | canonical cardboard, exclusion rule, 15 spc |
| AC-06 | P03-C/D, P04-E | `VU/test_gemini.py`, empty versus no-proposal cases | fallback path/empty rule identity |
| AC-07 | P04-E/H | `FE/settlement.test.ts`, pending UI | held points, 30-spc posting, ticket |
| AC-08 | P04-E, P06-D | controlled review-domain test | decision version, unique 13-point credit, -2 correction |
| AC-09 | P06-D, P07-A | old-cycle review/collection race case | original/current cycle IDs |
| AC-10 | P04-B/C/E/F, P07-A | submission/jobs/settlement/outbox race tests | request fingerprint, fence and posting IDs |
| AC-11 | P04-A/L, P06-D | sessions/recovery tests and reopen UI | owner/bin active reference, lease deadline |
| AC-12 | P04-L, P07-C | session-recovery tests, actual refresh/background run | persisted intent and server session version |
| AC-13 | P04-C/E/F, P06-D | recovery/deadline tests | attempt count, deadline, technical-review reason |
| AC-14 | P02-F, P04-E, P06-D | near-full/overflow and operator collection | raw occupied value, matching cycle |
| AC-15 | P05-D/E | `FE/rewards.test.ts`, backend redemption widget/live run | 37->12 wallet, one redemption/voucher |
| AC-16 | P05-D, P07-A | `FE/concurrency.test.ts` | transaction outcome and owner reward counter |
| AC-17 | P05-D/F | voucher policy/lifecycle/query tests | use event, server expiry and no refund |
| AC-18 | P06-A/B/C | notifications tests + Android/web send/receipt | notification intent, token association, permission |
| AC-19 | P06-E | maintenance test with controlled time | one reminder event/window |
| AC-20 | P06-E | Storage/emulator cleanup cases | manifest/generation and resolved/pending guard |
| AC-21 | P06-D/E, P07-C | service-availability and fallback-budget cases | overall unavailable versus Gemini-only reason |
| AC-22 | P02-A, P04-C, P07-A | rules/authorization and actual private-IAM checks | denied owner write/read, verified worker identity |
| AC-23 | P07-C, P08 | actual Android + HTTPS web checklist and release identity | build/runtime, camera/auth/push evidence |
| AC-24 | P01-C, P04-B/E, P05-B | immutable policy/guide historical receipt cases | pinned policy versus active policy |

## R2. Transaction and scope coverage

| Requirements | Verification |
| --- | --- |
| TX-01/07/09 | Submission identity/session uniqueness, changed payload/source/offer conflict, durable request recovery |
| TX-02/04 | Initial posting versus versioned difference correction, same/old cycle cases |
| TX-03/05/06 | Unique credit/debit entry, atomic record effects, concurrent nonnegative wallet |
| TX-08 | Stale attempt and post-review callback cannot alter accounting/reservations |
| FLOW-01 | Every named screen/action remains in backend integration tests and manual Android/web checks |
| SCOPE-01/02/05 | Real phone/browser QR and real cloud pixels, no local worker requirement or filename answer |
| SCOPE-03/04/06/07 | Both platforms, actual Firebase services, public Google residents, all resident features/scheduled work |
| SCOPE-08 | Full-scope seven-day target with honest gate/defect reporting |
| CV-AC-01..03 | Actual frozen evaluation report with declared denominators/configuration; no all-admin or zero-case inflation |

## R3. Minimum evidence index format

`docs/backend_evidence/ACCEPTANCE.md` must contain:

```text
Spec/plan version + source/deployment identity
AC ID | status | environment | actual command/manual steps | log/report path
      | trace/request/domain IDs | device/browser | defect/limitation
CV dataset/split/config digests + target numerator/denominator/results
Cost/latency report + dated pricing/provider access assumptions
Open defects / blockers / authorized deviations
Final milestone status and reviewer role
```

Use PASSED, FAILED, NOT_RUN or BLOCKED as appropriate, retaining the tester template's final PASSED/FAILED/CONDITIONALLY PASSED verdict. A required NOT_RUN prevents full conformance.

## R4. Local development workflows

### R4.1 Baseline mock regression

Working directory: repository root.

```powershell
flutter pub get
flutter analyze
flutter test
```

Record actual baseline failures before integration. The existing legacy journey uses old copy and mock balances; fix/update only for the specified semantics, not by changing the product UI to satisfy stale text finders.

### R4.2 Functions deterministic and emulator checks

Working directory `functions/`:

```powershell
npm ci
npm run build
npm run test:unit
```

Working directory repository root, with the explicit local emulator namespace configured:

```powershell
firebase emulators:exec --project <emulator-project> --only auth,firestore,functions,storage "npm --prefix functions run test:emulator"
```

The test script must not call live model services. Real Cloud Tasks, Cloud Run/IAM and FCM checks are separate deployed integration evidence.

### R4.3 Vision tests and model replay

These commands test hosted pretrained-model API clients and our matching/counting logic. They do not train models, upload labeled training datasets, or download model weights. Use a representative sample for the first API call; complete the larger evaluation set for the later acceptance report.

Working directory `services/vision/`:

```powershell
uv sync --frozen
uv run pytest
uv run python -m ecoloop_vision.tools.replay --help
uv run python -m ecoloop_vision.tools.evaluate --help
```

The implemented tools define explicit input/config/output and provider-call modes. Default replay is diagnostic-only and cannot settle finance. Record an actual successful command after implementation, rather than treating `--help` as feature proof.

### R4.4 Connected Flutter

Working directory repository root; use verified client options and the correct platform's emulator host:

```powershell
flutter run -d chrome --dart-define=BACKEND_MODE=emulator --dart-define=APP_ENV=emulator --dart-define=FIREBASE_EMULATOR_HOST=127.0.0.1
```

For a standard Android emulator, host access commonly uses `10.0.2.2`; verify actual network/runtime rather than hardcoding that address for real devices.

Live build/run explicitly uses `BACKEND_MODE=firebase` and `APP_ENV=poc`. Browser camera/push requires the proper secure origin; Android sign-in requires matching registered app/certificate metadata.

### R4.5 Read-only inspection

Working directory `functions/`, after the tools runner is implemented:

```powershell
npm run inspect -- --env=emulator --deposit-id <deposit-id>
```

Live inspection additionally requires the explicit verified project and operator credentials. The tool must display a redacted chain and accounting discrepancies, never auto-repair them.

## R5. Bug reproduction record

Use `.agent/templates/test_log_template.md` and `fix_log_template.md`. Minimum useful reproduction:

```text
Defect ID / severity / requirement:
Build + environment + contract/pipeline/policy/model versions:
Account context (safe alias, not credentials):
Steps and selected asset version/digest:
Expected / actual:
Trace, request, session, deposit, job, attempt and decision IDs:
Read-only inspection output / artifact refs / actual failing test:
Root cause confirmed or still unknown:
Fix files, retest command/result and related regression:
```

Do not guess root cause from a screen symptom. Follow diagnostics D8 and record the earliest incorrect boundary. Append retests to the original QA/fix record.

## R6. Controlled operator and future admin handoff

### Current operator tool

`functions/tools/operator.ts` uses the actual package/domain services and explicit environment/project, with emulator default. It may demonstrate authorized collection and controlled test review, under the specification's boundary.

- Collection requires bin/current cycle, no conflicting active session and an auditable run identity.
- Review-resolution testing uses a controlled emulator/domain harness; no resident endpoint or client role toggle.
- Live administrative UI/transports remain the later admin-backend implementation.
- Operator audit metadata must identify the actual authenticated principal/run where available; a user-supplied label is not proof of identity. Cloud service audit records remain authoritative for privileged access.

### Friend/admin contract packet

Provide `ADMIN_HANDOFF.md` with:

1. Schema version and real sample JSON with private fields redacted.
2. Collections/owner fields, authorized open-ticket queries and indexes.
3. Batch status/result outcomes including processing/empty and grouped lines.
4. Raw/evidence references, authorized image access, per-object scores and source semantics; no invented batch confidence average.
5. Future `resolveReview` request: stable request ID, deposit/ticket ID, expected decision version, final object decisions; actor derived from verified admin identity.
6. Expected response: same receipt identity, updated decision version, settlement/capacity/statistics/event effects and idempotent replay.
7. Future collection semantics and old-cycle correction behavior.
8. Current domain/harness evidence, plus exact frontend/admin endpoint work still assigned to that separate plan.

## R7. Final demo rehearsal

1. Check deployed source/config/image identities and service availability.
2. Fresh Google account has zero points; guide shows only the accepted classes/rates.
3. Real QR -> all screens -> choose/change one image -> Continue -> real pipeline -> receipt and correct wallet/occupancy.
4. Demonstrate an actual uncertain/excluded/empty case with evidence, retaining all failed evaluation cases in the report.
5. Redeem and consume a generated demo voucher; Copy code remains independent.
6. Show live push and controlled reminder/cleanup evidence; explain that test-time manipulation did not change normal validity.
7. Demonstrate interruption recovery and authorized full-bin collection/reset.
8. Starting with a receipt reference, find the run, ledger, capacity event and notification intent using documented diagnostics.
9. Confirm the developer PC's vision server is not required.
