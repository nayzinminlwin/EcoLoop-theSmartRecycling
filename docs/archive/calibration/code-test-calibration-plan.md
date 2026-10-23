# Code-Test Calibration Plan

## Purpose

Calibrate the Flutter test suite against the current application contracts,
fixtures, and asynchronous UI behavior. This plan records the failures
observed from the full `flutter test` run and the order in which they should be
addressed. The implementation status is recorded below.

## Original baseline

The full Flutter test suite currently reports seven failing tests. The failures
fall into four independent groups:

1. Firebase activity repository tests fail before exercising repository logic.
2. Fixture integrity expectations disagree with the current reward catalog.
3. Scan-flow tests rely on fragile timing and viewport interaction assumptions.
4. A visual capture test skips the required image-selection step.

The recent structured logging refactor and GitHub Actions Java 21 change do not
explain these failures. Focused command-client and logger tests passed after the
logging refactor.

## Implementation status

All calibration phases are complete:

1. Activity repository construction no longer evaluates the default Firebase
   statistics transport when a test supplies its own activity transport.
2. The fixture integrity expectation now matches the authoritative active
   reward catalog values `10/25/50/75`.
3. Scan-flow and visual-capture tests use reliable fake-time progression,
   explicit completion checks, visible interactions, and deterministic result
   routing.

Validation completed:

```text
flutter test
```

Result: all 159 tests passed.

```text
flutter analyze
```

Result: no issues found.

## Failure analysis

### 1. Activity repository tests initialize Firebase unexpectedly

**Affected file**

- `test/features/activity/firebase_activity_repository_test.dart`

**Observed failure**

```text
[core/no-app] No Firebase App '[DEFAULT]' has been created
```

**Cause**

`FirebaseActivityRepository` accepts a fake `ActivityReadTransport`, but its
constructor still eagerly creates the default statistics transport using
`FirebaseFirestore.instance`. The tests do not use statistics, but accessing
the default Firestore instance requires a configured Firebase app.

**Calibration target**

Ensure that tests injecting a read transport do not require Firebase
initialization. Prefer a dependency-construction path that does not evaluate
the default Firestore instance unless a Firebase-backed transport is actually
needed. Supplying a suitable fake statistics transport is another possible
approach, but the constructor behavior should be reviewed first.

**Validation**

Run:

```text
flutter test test/features/activity/firebase_activity_repository_test.dart
```

Expected result: all three activity repository tests pass without requiring
`Firebase.initializeApp()`.

### 2. Fixture integrity test uses stale reward prices

**Affected file**

- `test/fixtures/mock_fixture_integrity_test.dart`

**Current fixture**

- `assets/mock/rewards/catalog.json`
- Active prices: `10`, `25`, `50`, `75`

**Current test expectation**

```text
[100, 200, 350, 500]
```

**Cause**

The test and fixture have diverged. Current mock catalog data uses `10/25/50/75`,
while older plans, backend examples, and test expectations still contain
`100/200/350/500`.

**Calibration target**

First establish the authoritative product contract. Then update only the stale
source:

- If the current resident mock catalog is authoritative, update the test
  expectation and related stale references.
- If the higher prices are authoritative, update the fixture and audit all
  dependent wallet, redemption, and UI expectations.

Do not change the values based only on making this one test pass.

**Validation**

Run:

```text
flutter test test/fixtures/mock_fixture_integrity_test.dart
```

Also run the rewards-focused tests after the contract decision.

### 3. Scan-flow tests depend on fragile timing and hit testing

**Affected file**

- `test/features/scan/scan_flow_test.dart`

#### 3a. Result is not visible after an exact elapsed duration

The happy-path test configures a five-second mock classification delay and then
expects the `Verified` result after fixed-duration pumps. Completion also
requires asynchronous repository, Riverpod, stream, and router updates.

The failure occurs at the `Verified` assertion, indicating that the test reaches
the timing boundary before all state propagation and rendering are complete.

**Calibration target**

Replace exact-duration assumptions with state-based waiting that observes the
expected UI state while retaining a bounded timeout. The test should verify the
real completion behavior rather than rely on a single timing schedule.

#### 3b. Processing action is found but not hittable

The processing-resume test finds `Continue using EcoLoop`, but Flutter reports
that its tap coordinate is outside the hittable area or obscured at the
390x844 test viewport. Because the tap does not activate the action, the test
remains on the processing screen and the following `Processing`-absent
assertion fails.

**Calibration target**

Make the test interaction reliable by ensuring the target is visible and
hittable before tapping. Preserve the test's behavioral intent: leaving during
processing must not cancel the session, and returning later must resume the
result.

**Validation**

Run:

```text
flutter test test/features/scan/scan_flow_test.dart
```

Expected result: all scan-flow scenarios pass, including processing completion
and resume behavior.

### 4. Phase 3 visual capture skips image selection

**Affected file**

- `test/refactor_visuals/phase3_capture_test.dart`

**Observed failure**

```text
Expected: exactly one matching candidate
Actual: Found 0 widgets with text "Processing"
```

**Cause**

The test reaches the item-detected stage and taps `Continue` immediately. The
current UI intentionally requires an image asset to be selected before
`Continue` becomes enabled. The regular scan-flow test already selects
`PET plastic bottles` before continuing.

**Calibration target**

Add the missing asset-selection interaction to the capture sequence before
capturing the processing state. Keep the configured long classification delay
so the processing screen remains visible for the screenshot.

**Validation**

Run:

```text
flutter test test/refactor_visuals/phase3_capture_test.dart
```

Review generated visual artifacts separately and restore or retain them
according to the visual-regression workflow.

## Execution order

1. Fix the activity repository dependency initialization issue.
2. Decide and document the authoritative reward-price contract.
3. Calibrate scan-flow waiting and hit testing.
4. Correct the phase 3 visual capture sequence.
5. Run each focused test group.
6. Run the complete Flutter suite.
7. Check for generated visual artifacts and confirm the worktree contains only
   intentional changes.

## Validation commands

Focused tests:

```text
flutter test test/features/activity/firebase_activity_repository_test.dart
flutter test test/fixtures/mock_fixture_integrity_test.dart
flutter test test/features/scan/scan_flow_test.dart
flutter test test/refactor_visuals/phase3_capture_test.dart
```

Full suite:

```text
flutter test
```

## Completion criteria

- All previously failing tests pass.
- Reward values match one explicitly chosen product contract.
- Firebase-dependent repository tests remain independently testable.
- Scan tests use bounded state-based synchronization and reliable interactions.
- Visual capture tests reach the intended stages before taking screenshots.
- No unrelated files or generated artifacts remain modified.
