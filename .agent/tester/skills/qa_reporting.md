# QA Reporting Skill

## Purpose

Use this skill when documenting test results, reporting defects, or deciding the final status of an implementation.

The goal is to produce reports that are useful to the developer and maintain a clear testing history.

Use:

`/.agent/templates/test_log_template.md`

for the test log structure.

---

## 1. Reporting Principles

A QA report must be:

- Accurate
- Specific
- Reproducible
- Based on project requirements
- Focused on the tested scope

Do not invent requirements or report personal preferences as defects.

Separate:

- **Confirmed bugs**
- **Missing requirements**
- **Non-blocking concerns**
- **Suggestions**

Only confirmed defects should be reported as bugs.

---

## 2. Test Status

Use one of three statuses.

### PASSED

Use when:

- Required functionality works.
- Relevant tests pass.
- No blocking or significant unresolved defects remain.

Minor observations that do not affect the approved requirements may be noted without changing the status.

### CONDITIONALLY PASSED

Use when:

- Core requirements work.
- The implementation is usable.
- Non-blocking issues remain.

Clearly state what remains and why the implementation can still proceed.

### FAILED

Use when:

- A required feature is missing.
- Required behavior does not work.
- A critical integration fails.
- Data integrity or security is compromised.
- A blocking accessibility or functional issue exists.

A FAILED result must clearly state what needs to be fixed.

---

## 3. Bug Severity

### Critical

The feature or application is unusable, data may be seriously compromised, or a major security failure exists.

Examples:

- App crashes during a core flow.
- Users can access another user's data.
- Data is corrupted or permanently lost.

### High

A major required feature does not work, but the application may still be partially usable.

Examples:

- Login cannot complete.
- Deposit transaction data cannot be saved.
- Wallet balance is not updated after a deposit or redemption.
- A required Firebase integration fails.

### Medium

The feature works partially, but important behavior is incorrect or unreliable.

Examples:

- Incorrect state after an action.
- Error handling is broken.
- Important UI behavior fails in a specific scenario.

### Low

A minor issue with limited impact.

Examples:

- Minor layout inconsistency.
- Incorrect non-critical text.
- Small visual defect.

Severity represents **impact**, not how easy the bug is to fix.

---

## 4. Writing a Bug Report

Every bug should answer:

1. **What is wrong?**
2. **Where does it happen?**
3. **What should happen?**
4. **What actually happens?**
5. **How can it be reproduced?**
6. **What evidence supports it?**

Use clear titles.

Good:

> `[BUG-03] Wallet balance is duplicated after a deposit sync`

Bad:

> `Schedule issue`

If the exact source of the problem is unknown, report the affected component or flow instead of guessing.

---

## 5. Evidence

Include evidence when available:

- Failed test output
- Error or exception messages
- Relevant logs
- File paths
- Steps to reproduce
- Screenshots or recordings when available

Do not claim a defect is reproduced unless it was actually reproduced or directly confirmed through code/test evidence.

---

## 6. Retesting

When a developer reports a fix:

1. Review the original issue.
2. Retest the original reproduction steps.
3. Test the relevant surrounding behavior for regressions.
4. Update the existing test log.

Do not create a separate test log for a retest of the same implementation.

Mark the issue as:

- **Resolved**
- **Still Failing**
- **Partially Resolved**

If new defects are discovered during retesting, add them as new issues in the same log when they belong to the same testing scope.

---

## 7. Scope Discipline

Test the assigned implementation and its directly affected behavior.

Do not:

- Expand the task into a full application audit.
- Create unrelated bug reports.
- Block progress because of unrelated existing issues.
- Reject code solely because it differs from a preferred style.

However, if testing reveals a serious issue outside the assigned scope that directly affects the tested feature, report it clearly.

---

## 8. Final Summary

Every test log must end with:

- Final status
- Short summary
- Remaining issues, if any
- Required next action

Keep the final summary concise.

The developer should be able to immediately understand:

> **Can this implementation proceed, or does it need to come back for fixes?**