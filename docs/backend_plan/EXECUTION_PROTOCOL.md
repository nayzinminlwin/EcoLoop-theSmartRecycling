# Backend Execution Protocol

- **Parent:** [Implementation plan](../ECOLOOP_BACKEND_IMPLEMENTATION_PLAN.md)
- **Authority:** [Specification v1.1](../ECOLOOP_BACKEND_AND_CV_SPECIFICATION.md)

## 1. Instruction loading and role ownership

Before each unit:

1. Read applicable harness/system instructions and any actual `AGENTS.md` in the target path hierarchy.
2. Read this protocol and the current tracker checkpoint.
3. Load the **existing** role instructions relevant to the work:

| Work | Mandatory reference |
| --- | --- |
| Flutter implementation | `/.agent/developer/agent.md` |
| Flutter QA | `/.agent/tester/agent.md` |
| Flutter/Firebase QA | `/.agent/tester/skills/testing_flutter.md`, `/.agent/tester/skills/testing_firebase.md`, and `/.agent/tester/skills/qa_reporting.md` as applicable |
| Accessibility verification | `/.agent/tester/skills/accessibility_testing.md` when testing changed UI |
| Admin frontend changes in a separately authorized scope | `/.agent/web_developer/agent.md`; current plan does not assign those changes |
| Dev / QA / fix records | Corresponding files under `/.agent/templates/` |

Leading `/` in these references means **repository root**, not the Windows drive root. Resolve real paths before reading. The `.agent/` directory can be hidden/ignored by glob tools; direct reads of the known files are valid.

There is no existing backend-specific role file in this repository. For `functions/`, `services/vision/`, contracts, infrastructure, tools and their tests, Luna acts as the **integration executor explicitly assigned by this plan**. Do not pretend that Flutter-only or admin-web ownership grants unrestricted ownership of other folders. Role changes can be sequential in the same executor; this plan does not require spawning subagents.

### 1.1 Reconcile historical instructions explicitly

The developer/tester files were written for the completed Goal 1-2 UI effort and point to the old UI plan. This user-authorized backend task is Goals 3-4, using the new specification and active implementation plan. Consequently:

- The retained mock runtime follows its mock-only assumptions.
- Firebase work is allowed in the explicitly assigned backend/emulator/live integration units.
- Scope manifests and the new specification govern the new batch contracts.
- Read-only design artifacts, protected native files, user-work preservation, role boundaries, relevant-log discipline and reporting templates remain applicable.
- If a hard restriction cannot be reconciled with a needed change, record the exact file/blocker and request the moderator's resolution. Do not silently rewrite the role file.

Do not edit the role files as part of this plan. Never modify the three protected Android files or design artifacts by running a setup CLI that rewrites them indirectly.

### 1.2 Current model scope: pretrained APIs only

Specification v1.1 incorporates the user's explicit clarification: A/B/D run on Roboflow through their existing hosted APIs. Cloud Run runs our Python API orchestration and returned-box processing. Do not create training jobs, fork/upload datasets, download/export weights, or install a local model-inference runtime as a prerequisite.

The approximately 100 labeled images are test cases for scoring existing predictions and our matching/counting logic. They do not train a model and need not be ready before the first representative API smoke call. Earlier captured readiness evidence is historical; preserve its completed inventory and use this clarified scope for the next unit.

### 1.3 Git instructions

Role files contain commit defaults. The executing harness's higher-priority instructions and moderator authorization still govern whether commits are allowed. When commits are authorized:

- Inspect status, diff and recent log; stage only intended current-unit files.
- Use the role file's `gh issue list --repo nayzinminlwin/EcoLoop-theSmartRecycling` convention for related issue tags.
- Issue descriptions are not implementation requirements.
- Keep independently verified units/phases traceable in commits where practical; record the SHA.

Without commit authorization, keep a precise uncommitted checkpoint with base revision, changed paths, logs and remaining steps. Do not use `git add .`, destructive cleanup, hook skipping or forced history changes to manufacture a clean state.

## 2. Context pack and bounded execution

Use this order after every reset:

1. Master plan phase/milestone table.
2. Tracker's current unit and last relevant dev/QA/fix log.
3. Applicable role file.
4. Current unit and its cited architecture/diagnostic sections.
5. Specification sections cited by the unit.
6. Actual target files and directly imported prerequisites.

Read only relevant logs. Do not ingest all plan companions, source files and logs for every small task. Use heading-based lookup because line numbers change.

Normally a unit changes 3-6 code/config/test files. Explicitly identified contract-migration clusters may involve up to ten production files plus focused tests; their substeps are one atomic compatibility gate. Generated dependency locks, compiler outputs, dev/QA/fix logs and tracker updates must be listed separately. Never mark a migration passed while its consumers fail analysis.

Resolve every target to a repository-relative path before editing. Phase documents use these explicit short-path conventions inside a clearly named runtime/feature unit:

- Functions `application/`, `domain/`, `infrastructure/`, `transport/` are under `functions/src/`; its `tests/` are under `functions/tests/`.
- Vision `application/`, `domain/`, `adapters/`, `infrastructure/`, `tools/` and bare package modules are under `services/vision/src/ecoloop_vision/`; its `tests/` are under `services/vision/tests/`.
- Vision `Dockerfile`, `pyproject.toml`, `uv.lock` and `model_registry.json` are under `services/vision/`.
- Feature-relative Dart paths in a target list use the explicitly named `lib/features/<feature>/` base. A bare model filename after a full model-directory path uses that same directory.

Write the expanded paths into the checkpoint. If a target remains ambiguous, locate its actual source rather than creating an unintended root-level file.

If the task grows:

1. Identify the exact missing dependency/contract.
2. Add a bounded child unit such as `BK-P04-H.1` with named files, reason and gate in the tracker.
3. Preserve the parent acceptance requirement and record the adjustment.
4. Do not invent new product behavior or weaken a gate.

Keep one unit in progress. Independent dataset preparation may continue as a human/team workstream, but it is not automatic permission for autonomous parallel agents or conflicting edits.

When the moderator authorizes an entire phase or the implementation plan, proceed through its unblocked units sequentially after their gates pass. A small unit is a resumable checkpoint, not a requirement to request approval after every ordinary edit. Pause for actual scope/instruction conflicts, missing external prerequisites, failed gates requiring resolution, or a user stop instruction.

## 3. Unit lifecycle

```text
NOT_STARTED -> IN_PROGRESS -> IMPLEMENTED -> VERIFIED -> COMPLETE
                        \-> BLOCKED / FAILED -> focused fix -> retest
```

- **IMPLEMENTED:** code is present; required evidence is not yet complete.
- **VERIFIED:** relevant automated/manual gates really passed.
- **COMPLETE:** verified, documented, tracker updated and handoff coherent.
- **BLOCKED:** identify missing credential/tool/permission/input and the exact affected gate.
- **FAILED:** implementation violates an assigned requirement or a required check fails.

A conditional QA result cannot turn missing real-camera, push, model-access or financial-correctness evidence into a full milestone pass.

## 4. Reusable execution checklist

### Before editing

- Confirm workspace and current user changes with `git status --short`.
- Inspect target files before patches; preserve unrelated edits and untracked user files.
- Confirm predecessor gates and actual availability of imports.
- Check the unit's source-of-truth and expected observable events.
- Confirm test mode and target project; an emulator namespace is not a newly selected live Firebase project.

### While implementing

- Use focused patches and the surrounding code's style.
- Add diagnostics at command/stage/commit boundaries, not in every widget build or model loop.
- Keep all work within named targets; record genuinely necessary child units.
- Keep handlers thin, business rules pure, SDK types at adapter boundaries, and Flutter Riverpod composition centralized.
- Introduce a dependency only when its runtime purpose is stated and its version is recorded/locked.
- Export only handlers that exist and have their prerequisites. Avoid future-phase imports and runtime placeholders.

### Before completion

- Run the narrow gate, then directly affected regressions. Broaden only for changed dependencies, failures or unresolved concerns.
- Capture exact commands, environment, outputs, IDs and artifact references.
- Classify actual bugs versus missing requirements or suggestions using QA reporting instructions.
- Update logs/checkpoint and identify the single next executable unit.

## 5. Documentation and checkpoint contract

Use the repository templates, adding these trace fields within their existing sections:

```text
Unit: BK-P04-E
Role: Integration executor / Flutter developer / Flutter QA
Specification: sections and TX/AC IDs
Base source revision + dirty/source-bundle identity:
Files created/modified/generated:
Contract/config/model versions:
Commands actually run + working directory + result:
Environment/project mode:
Example traceId / requestId / sessionId / depositId / jobId:
Evidence paths:
Defect IDs and unresolved blockers:
Commit SHA or explicit uncommitted status:
Next unit and required read set:
```

Suggested names following the existing templates:

- Dev: `docs/dev_logs/YYYY-MM-DD_Backend_BK-P04-E_Settlement.md`.
- QA: `docs/test_logs/YYYY-MM-DD_BK-P04-E_Settlement_QA.md`.
- Fix: `docs/fix_logs/YYYY-MM-DD_FIX_Backend_BK-P04-E_Settlement.md`.

Retest the original QA record and append follow-up fixes to the same relevant fix log. Never fabricate test output, screenshots, deployed URLs or measured metrics.

## 6. Commands and environment discipline

Current shell is Windows PowerShell 5.1. Use the tool's working-directory option instead of changing directories inside commands. Execute command examples separately; do not translate them into unsupported `&&` chains. Use dedicated file tools for reads/searches/edits; `rg` is not currently on PATH, so do not assume it exists.

The implementation will define these script contracts:

| Working directory | Command contract | Meaning |
| --- | --- | --- |
| `functions/` | `npm run build` | Typecheck/build and package canonical schemas into deploy output |
| `functions/` | `npm run test:unit -- <file-filter>` | Vitest deterministic tests; no external APIs |
| Repository root | `firebase emulators:exec --project <emulator-project> --only auth,firestore,functions,storage "npm --prefix functions run test:emulator"` | Local integration/rules gates; script established in P02 |
| `services/vision/` | `uv sync --frozen` | Reproduce selected dependencies from `uv.lock` |
| `services/vision/` | `uv run pytest <test-path>` | Focused Python tests |
| Repository root | `flutter analyze` | Flutter static gate |
| Repository root | `flutter test <test-path>` | Focused Dart/widget gates |
| Repository root | `flutter test` | Relevant whole-suite regression checkpoints |
| Repository root | `flutter build web --dart-define=BACKEND_MODE=firebase --dart-define=APP_ENV=poc` | Explicit deployed web composition after real config exists |

Verify tools before use: Flutter/Dart, Node 22/npm, Python 3.12/uv, Java compatible with the installed emulators, Firebase CLI, Google Cloud CLI and Git/GitHub CLI as applicable. Record actual versions. Install current compatible packages using official documentation, not model-memory guesses.

Live project IDs, app IDs, bucket names, host URLs, OAuth clients and secret references come from verified existing resources. Use attached service identities/approved local credentials. Runtime secrets never go into documentation or test fixtures.

## 7. Copy-ready continuation prompt

```text
Continue unit <BK-ID> from <phase-document>.
First read docs/backend_plan/EXECUTION_PROTOCOL.md, the tracker checkpoint,
and the applicable /.agent role instructions. Use ECOLOOP-SPEC-001 as authority.
Inspect current changes and only this unit's targets/direct dependencies.
Implement the stated behavior, diagnostic events and meaningful checks.
Keep external side effects outside retried database transactions.
Record exact results, IDs, blockers and changed files with repository templates.
Update the tracker. Do not mark real integration evidence passed from mocks.
```

## 8. Evidence and generated outputs

Create evidence files during execution, not pre-filled success reports:

```text
docs/backend_evidence/READINESS.md
docs/backend_evidence/MODEL_ACCESS.md
docs/backend_evidence/ENVIRONMENT.md
docs/backend_evidence/CONTRACT_DECISIONS.md
docs/backend_evidence/DEPLOYMENT.md
docs/backend_evidence/CV_EVALUATION.md
docs/backend_evidence/COST_AND_LATENCY.md
docs/backend_evidence/ACCEPTANCE.md
docs/backend_evidence/ADMIN_HANDOFF.md
```

Large images, API-response caches, raw responses and generated reports use explicitly ignored local artifact directories or versioned Storage. Keep compact manifests/digests and redacted report summaries in the evidence index. Generated locks are reviewed artifacts; generated caches/build folders are not source-file replacements. Model weights are not part of the deployment.
