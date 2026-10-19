# Demo Refactor Execution Tracker

- **Plan:** [ECOLOOP-DEMO-REFACTOR-001](../ECOLOOP_DEMO_REFACTOR_PLAN.md)
- **Audit:** [UA-001–UA-055](../ECOLOOP_ULTIMATE_BACKEND_AUDIT.md)
- **Created:** 2026-10-20
- **Base source:** `efa364a`, branch `dev`; this tracker records a new refactor, not completion of the old P00–P08 plan
- **Current phase:** H1 — NOT_STARTED
- **Implementation status:** Full H1/A1–A5 refactor not started. A separately requested live reference-data/QR prerequisite was completed on 2026-10-20; see the evidence below.

### Completed pre-phase prerequisite — sample seeding

Developer approved reasonable defaults and live sample seeding. [Seeding and QR evidence](evidence/SEEDING_AND_QR.md) records 56 reference documents in `ecoloop-db`, 16 real Storage image objects, six decoded registered QR PNGs, four passing emulator safety tests and successful independent live readback. Main bin: `bin-demo-main`; QR: `ecoloop://bin/qr-demo-main`. Processing remains paused pending the actual refactor/worker gate. This does not complete H1 or A1.

## 1. Phase ledger

| Phase | Lead | Status | Actual evidence | Commit SHA |
| --- | --- | --- | --- | --- |
| H1 existing identity/platform/demo access | Developer | NOT_STARTED | — | — |
| A1 contract/auth/real Home | Agent | NOT_STARTED | — | — |
| A2 transaction/scan/accounting/rewards/recovery | Agent | NOT_STARTED | — | — |
| A3 Tasks/service identity/vision/fallback/evidence | Agent | NOT_STARTED | — | — |
| H2 console/provider/infrastructure handoff | Developer | NOT_STARTED | — | — |
| A4 UI/operations/current deployed candidate | Agent | NOT_STARTED | — | — |
| H3 independent device/browser rehearsal | Developer | NOT_STARTED | — | — |
| A5 defect closure/final release freeze | Agent | NOT_STARTED | — | — |

Allowed states: NOT_STARTED, IN_PROGRESS, IMPLEMENTED, VERIFIED, COMPLETE, BLOCKED, FAILED. Only one agent phase is active. COMPLETE requires its actual gate, developer observations where required, evidence and the phase commit. Record a blocked checkpoint truthfully; never invent a test/commit/console confirmation.

## 2. Resume checkpoint

```text
Updated:
Executor/model and role:
Actual presentation date/time/time zone; hours remaining:
Phase and bounded substep:
Source SHA and current dirty/user-owned paths:
Explicit Firebase mode / project / database / regions:
Android distribution/signing/App Check mode:
Exact target files inspected/changed:
Contract/schema/policy/config/model identities:
Last actually executed command and result:
Current first failing boundary + reproduction:
Safe request/trace/session/batch/job/attempt/result IDs:
Evidence paths:
Audit findings closed, with independent proof:
Open blockers, owner, exact next action:
Commit SHA or explicit uncommitted/blocked state:
Next exact substep and required read set:
```

Preserve initially untracked `.vscode/`, `Demo_Screenshots/`, `android/build/`, `assets/trash_images/` unless their owner explicitly authorizes a scoped change. Never stage these incidentally.

During final planning verification, Git additionally reported modified platform/configuration files (including `LICENSE`, `analysis_options.yaml`, Android/iOS files and `web/index.html`/`manifest.json`) with LF/CRLF warnings; targeted `git diff`/`--numstat` showed no textual diff. These paths were not edited or staged by the documentation task. Inspect their actual state at H1 and preserve them rather than cleaning or including them in a phase commit automatically.

## 3. Public configuration handoff

Fill only verified public identifiers/statuses; no API keys, debug tokens, service credentials, FCM tokens or full voucher codes.

| Input | Planned baseline | Actual verified value / evidence |
| --- | --- | --- |
| Project | `ecoloop-thesmartrecycling` | Pending H1 |
| Database | `ecoloop-db` | Live-observed in audit; reverify H1 |
| Resident/gateway region | `us-central1` | Live-observed; A1 makes explicit |
| Vision/Tasks/schedules | `asia-southeast1` | Live-observed; reverify H2 |
| Android app ID/signing | Actual installed app; historical `sd.idk.ecoLoop` | Pending H1 |
| Demo Android distribution | Known debug sideload + registered debug App Check, unless release route already verified | Pending H1 |
| Web App Check public site key/provider | Intended Hosting domain | Pending H1/H2 |
| Hosting URL/target | Resident existing project target | Pending H1/H2 |
| VAPID public key status | Explicit build input | Pending H2 |
| Provider secret resource/version references | Managed server-side only | Pending H2 |
| Runtime/task/gateway identities/audiences | Exact scoped service contract | Pending A3/H2 |
| Exact login hotfix/launch defines | Record current actual behavior | Pending H1 |

## 4. Finding disposition register

Each finding has exactly one primary implementation owner below. Other phases supply dependent integration/retest evidence. All start OPEN; planning is not a fix.

| Audit ID | Primary owner phase | Status | Actual change | Independent regression/live evidence | Commit |
| --- | --- | --- | --- | --- | --- |
| UA-001 regions | A1 | OPEN | — | — | — |
| UA-002 named database | A1 | IN_PROGRESS | Seed tool/test/live target corrected; application clients still pending | `evidence/SEEDING_AND_QR.md` | Uncommitted |
| UA-003 actual-path rules | A1 | OPEN | — | — | — |
| UA-004 auth readiness/replay | A1 | OPEN | — | — | — |
| UA-005 profile DTO | A1 | OPEN | — | — | — |
| UA-006 request envelope | A1 | OPEN | — | — | — |
| UA-007 missing account operations | A1 | OPEN | — | — | — |
| UA-008 callable errors | A1 | OPEN | — | — | — |
| UA-009 intent recovery | A2 | OPEN | — | — | — |
| UA-010 UID lifecycle | A1 | OPEN | — | — | — |
| UA-011 real clock | A1 | OPEN | — | — | — |
| UA-012 draft/Continue | A2 | OPEN | — | — | — |
| UA-013 scan instructions/result rendering | A2 | OPEN | — | — | — |
| UA-014 active-session discovery | A2 | OPEN | — | — | — |
| UA-015 QR/expiry transactions | A2 | OPEN | — | — | — |
| UA-016 history/result record contract | A2 | OPEN | — | — | — |
| UA-017 indexes/pagination/live windows | A2 | OPEN | — | — | — |
| UA-018 current guide | A1 | OPEN | — | — | — |
| UA-019 complete nondestructive seed | A1 | IN_PROGRESS | New complete create-only reference seed applied; full A1 consumer/migration gate pending | Four emulator tests + live hash/readback + six QR decodes | Uncommitted |
| UA-020 redemption replay receipt | A2 | OPEN | — | — | — |
| UA-021 voucher metadata/use | A2 | OPEN | — | — | — |
| UA-022 scoped catalog/voucher feeds | A2 | OPEN | — | — | — |
| UA-023 capacity projections | A2 | OPEN | — | — | — |
| UA-024 accepted stats | A2 | OPEN | — | — | — |
| UA-025 terminal recovery | A2 | OPEN | — | — | — |
| UA-026 review/collection contract | A2 | OPEN | — | — | — |
| UA-027 pinned complete policy | A2 | OPEN | — | — | — |
| UA-028 semantic finalization validation | A2 | OPEN | — | — | — |
| UA-029 service OIDC identity | A3 | OPEN | — | — | — |
| UA-030 private committed source | A3 | OPEN | — | — | — |
| UA-031 Tasks route/retry/deadline | A3 | OPEN | — | — | — |
| UA-032 production provider composition | A3 | OPEN | — | — | — |
| UA-033 safe inventory/failure decision | A3 | OPEN | — | — | — |
| UA-034 specialist evidence application | A3 | OPEN | — | — | — |
| UA-035 Gemini schema/prompt/bounds | A3 | OPEN | — | — | — |
| UA-036 confidence/taxonomy/count rules | A3 | OPEN | — | — | — |
| UA-037 real provider/lease budgets | A3 | OPEN | — | — | — |
| UA-038 durable canonical run evidence | A3 | OPEN | — | — | — |
| UA-039 actual artifact retention | A4 | OPEN | — | — | — |
| UA-040 current token ownership | A4 | OPEN | — | — | — |
| UA-041 durable multi-device dispatch | A4 | OPEN | — | — | — |
| UA-042 authorized notification routing | A4 | OPEN | — | — | — |
| UA-043 web background/click path | A4 | OPEN | — | — | — |
| UA-044 trusted provisioning claims | A1 | OPEN | — | — | — |
| UA-045 actual App Check | A1 | OPEN | — | — | — |
| UA-046 role/private access/validation | A1 | OPEN | — | — | — |
| UA-047 availability/cost bounds | A3 | OPEN | — | — | — |
| UA-048 reproducible deploy | A4 | OPEN | — | — | — |
| UA-049 current live deployment | A4 | OPEN | — | — | — |
| UA-050 trustworthy diagnosis/replay | A4 | OPEN | — | — | — |
| UA-051 independent accounting/rebuild | A2 | OPEN | — | — | — |
| UA-052 correct CV metrics/demo scope | A3 | OPEN | — | — | — |
| UA-053 cross-boundary acceptance | A4 | OPEN | — | — | — |
| UA-054 lossless version/class semantics | A1 | OPEN | — | — | — |
| UA-055 CI/active docs/gates | A4 | OPEN | — | — | — |

Valid dispositions: OPEN, IN_PROGRESS, FIXED_VERIFIED, BLOCKED, DEMO_SCOPE_CHANGED. A scope change requires the actual user direction/addendum and precise remaining limitation; it is not a defect fix. UA-052 requires the agent to fix metric software even though the user removed manual/frozen-label measurement as a demo prerequisite.

## 5. Demonstration acceptance ledger

| Gate | Android actual observation | HTTPS web actual observation | Backend trace/invariant proof |
| --- | --- | --- | --- |
| Fresh Google user -> stable Home/zero wallet | NOT_RUN | NOT_RUN | NOT_RUN |
| Actual QR/all intermediate stages | NOT_RUN | NOT_RUN | NOT_RUN |
| Selection replacement/no inference before Continue | NOT_RUN | NOT_RUN | NOT_RUN |
| Genuine hosted inference -> useful automatic receipt | NOT_RUN | NOT_RUN | NOT_RUN |
| Low-confidence YOLO -> Gemini -> review if uncertain | NOT_RUN | NOT_RUN | NOT_RUN |
| Wallet/history/stats/occupancy coherent | NOT_RUN | NOT_RUN | NOT_RUN |
| Reopen/ambiguous/duplicate/terminal recovery | NOT_RUN | NOT_RUN | NOT_RUN |
| Redeem/copy/simulated use | NOT_RUN | NOT_RUN | NOT_RUN |
| Account switching/private ownership | NOT_RUN | NOT_RUN | NOT_RUN |
| Permission denied remains recoverable | NOT_RUN | NOT_RUN | NOT_RUN |
| Granted push/background/open once | NOT_RUN | NOT_RUN | NOT_RUN |
| Review ticket/authorized queue report | NOT_RUN | NOT_RUN | NOT_RUN |
| Controlled reminder/retention/collection | NOT_RUN | NOT_RUN | NOT_RUN |
| Exact final deployed build/digest/config | NOT_RUN | NOT_RUN | NOT_RUN |

## 6. Evidence and final release index

Populate files only with actual observations:

```text
evidence/H1_ENVIRONMENT.md
evidence/SEEDING_AND_QR.md
evidence/A1_CONTRACT_MAP.md
evidence/A1_HOME_GATE.md
evidence/A2_INVARIANTS.md
evidence/A3_VISION_AND_TRANSPORT.md
evidence/H2_CLOUD_HANDOFF.md
evidence/A4_CANDIDATE_RELEASE.md
evidence/H3_REHEARSAL.md
evidence/A5_FINAL_GATES.md
evidence/FINAL_RELEASE.md
DEMO_RUNBOOK.md
OPERATOR_RUNBOOK.md
```

No frozen-image labeling work is assigned. Report real model IDs, actual decision paths, software checks and measured demo latency. Do not report unmeasured CV precision or all-in operating cost as proven.
