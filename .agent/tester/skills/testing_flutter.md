# Flutter Testing Skill

## Purpose

Use this skill when testing Flutter application code, including business logic, Riverpod state, widgets, navigation, and complete user flows.

The goal is to verify behavior rather than simply verify that code executes without errors.

---

## 1. Test Level

Choose the lowest appropriate test level first.

### Unit Tests

Use for isolated:

- Business logic
- Models and serialization
- Utility functions
- Validation
- Repository logic with mocked dependencies
- Riverpod logic that can be tested independently

Prefer unit tests for deterministic logic.

### Widget Tests

Use for:

- Widget behavior
- User interaction
- Rendering important states
- Form validation
- Loading, success, empty, and error states
- Navigation triggered by widgets

Test behavior visible to the user rather than internal implementation details.

### Integration Tests

Use when multiple real application components must work together.

Examples:

- Authentication flow
- Multi-screen workflows
- Firebase-backed flows
- Important end-to-end user journeys

Do not replace large numbers of unit tests with integration tests when the behavior can be tested more cheaply at unit level.

---

## 2. What to Verify

For each relevant feature, consider:

- Happy path
- Invalid input
- Empty state
- Loading state
- Error state
- Boundary conditions
- Repeated actions
- Navigation
- State changes
- Persistence
- Recovery after failure

Only test scenarios relevant to the feature.

---

## 3. Riverpod

When testing Riverpod:

- Verify the provider produces the correct state.
- Verify state transitions.
- Verify loading and error states.
- Verify dependencies are correctly provided.
- Verify providers react correctly when dependencies change.

Avoid tests that only prove a provider exists.

Test the observable behavior produced by the provider.

---

## 4. Widgets & UI

Verify:

- Important widgets appear when expected.
- User interactions trigger the correct behavior.
- Buttons and controls are enabled/disabled appropriately.
- Forms validate correctly.
- Loading indicators appear during asynchronous work.
- Errors are presented appropriately.
- Empty states are handled.
- Navigation reaches the correct destination.

Avoid coupling tests unnecessarily to implementation-specific widget structure.

Prefer semantic or user-visible identifiers where practical.

---

## 5. State & Async Behavior

Pay particular attention to asynchronous operations.

Test:

- Initial state
- Loading state
- Success state
- Failure state
- Retry behavior
- Cancellation or disposal where relevant
- State after navigation or rebuild

Watch for:

- `setState()` after disposal
- Unhandled exceptions
- Stale state
- Duplicate requests
- Infinite loading
- Race conditions

---

## 6. Regression Testing

When a change modifies existing functionality:

1. Test the changed behavior.
2. Test directly related behavior.
3. Run existing automated tests for the affected area.
4. Investigate newly failing tests.

Do not require the entire application to be manually retested for every small change unless the change has broad impact.

---

## 7. Test Quality

A useful test should fail when the intended behavior breaks.

Avoid:

- Tests that only execute code without assertions.
- Duplicate tests covering the same behavior.
- Tests coupled to irrelevant implementation details.
- Artificial tests written only to increase coverage.

The project targets strong automated coverage, including an **80% unit-test coverage target for relevant business logic**. Coverage numbers must represent meaningful tested behavior, not inflated statistics.

---

## 8. Completion Criteria

Flutter testing is sufficient when:

- Relevant automated tests pass.
- Important user-visible behavior has been verified.
- Relevant error and boundary cases have been considered.
- No unexplained regression remains.
- Results are recorded in the test log.